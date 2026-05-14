import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { View } from '../App';
import { createBillingOrder, fetchSubscription, verifyBillingPayment, type BillingInterval, type BillingPlan, type SubscriptionState } from '../lib/billing';
import { getStoredUser } from '../lib/session';
import { cn } from '../lib/utils';

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface PricingProps {
  onViewChange: (view: View) => void;
}

const PLAN_DETAILS: Array<{
  id: BillingPlan;
  name: string;
  icon: React.ElementType;
  accent: string;
  description: string;
  monthly: string;
  annual: string;
  helper: string;
  features: string[];
  mutedFeatures?: string[];
}> = [
  {
    id: 'free',
    name: 'Free',
    icon: Sparkles,
    accent: 'bg-[#f1efe8] text-[#5f5e5a]',
    description: 'Start preparing without a card.',
    monthly: '₹0',
    annual: '₹0',
    helper: 'No credit card required',
    features: ['1 active domain', '20 question-bank questions/day', 'First 2 modules of any practice track', '1 GitHub repo scan'],
    mutedFeatures: ['No mock interviews', 'No coding rounds', 'No PDF exports'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Rocket,
    accent: 'bg-[#e1f5ee] text-[#0f6e56]',
    description: 'Everything needed for serious interview prep.',
    monthly: '₹999',
    annual: '₹8,499',
    helper: 'Annual saves over 25%',
    features: ['All domains unlocked', 'Unlimited question bank', 'Full practice tracks', '5 mock interviews/month', '10 coding problems/month', 'Unlimited scenario rounds', '5 GitHub repos + PDF export'],
  },
  {
    id: 'team',
    name: 'Team',
    icon: Users,
    accent: 'bg-[#eeedfe] text-[#534ab7]',
    description: 'Built for prep cohorts and placement teams.',
    monthly: '₹2,499',
    annual: '₹25,188',
    helper: 'Per user, 3-seat minimum',
    features: ['Everything in Pro', 'Team readiness dashboard', 'Shared question banks', 'Custom scenario creation', 'Unlimited repos', 'Priority support', 'Bulk seat management'],
  },
];

const COMPARISON_ROWS: Array<{ category?: string; feature?: string; free?: string | boolean; pro?: string | boolean; team?: string | boolean }> = [
  { category: 'Practice' },
  { feature: 'Active domains', free: '1', pro: 'All domains', team: 'All domains' },
  { feature: 'Question bank', free: '20/day', pro: 'Unlimited', team: 'Unlimited' },
  { feature: 'Practice track modules', free: 'First 2', pro: 'All', team: 'All' },
  { feature: 'Scenario round', free: false, pro: 'Unlimited', team: 'Unlimited' },
  { category: 'Rounds' },
  { feature: 'Mock interviews/month', free: false, pro: '5', team: 'Unlimited' },
  { feature: 'Coding round problems/month', free: false, pro: '10', team: 'Unlimited' },
  { feature: 'Interview personas', free: false, pro: '3 personas', team: 'Custom personas' },
  { category: 'GitHub + Reports' },
  { feature: 'GitHub repo scans', free: '1', pro: '5', team: 'Unlimited' },
  { feature: 'Repo-specific questions', free: true, pro: true, team: true },
  { feature: 'PDF report export', free: false, pro: true, team: true },
  { feature: 'Gap analysis report', free: false, pro: true, team: true },
  { category: 'Team' },
  { feature: 'Team readiness dashboard', free: false, pro: false, team: true },
  { feature: 'Custom scenario creation', free: false, pro: false, team: true },
  { feature: 'Shared question banks', free: false, pro: false, team: true },
  { feature: 'Priority support', free: false, pro: false, team: true },
];

const FAQS = [
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Your plan remains active until the end of the paid period, and the app falls back to Free after that period ends.',
  },
  {
    question: 'Does the free plan expire?',
    answer: 'No. Free stays available forever with the daily question limit, first two practice-track modules, and one GitHub repo scan.',
  },
  {
    question: 'What domains are covered?',
    answer: 'Frontend, Backend, AI/ML, Cybersecurity, Data Analytics, and Data Science are available today. Pro and Team unlock all domains.',
  },
  {
    question: 'How does Razorpay billing work?',
    answer: 'Repoid creates a Razorpay order from the server, opens Razorpay Checkout, then verifies the payment signature before upgrading the account.',
  },
  {
    question: 'Is Team per seat?',
    answer: 'Yes. Team is per user with a 3-seat minimum, built for groups that need shared banks, readiness views, and custom scenarios.',
  },
];

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function FeatureValue({ value }: { value: string | boolean | undefined }) {
  if (value === true) return <Check size={16} className="mx-auto text-[#0f6e56]" />;
  if (value === false || value === undefined) return <X size={15} className="mx-auto text-blueprint-muted" />;
  return <span className="rounded-md bg-[#efeded] px-2 py-1 text-technical-mono text-primary">{value}</span>;
}

export default function Pricing({ onViewChange }: PricingProps) {
  const user = getStoredUser();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [teamSeats, setTeamSeats] = useState(3);
  const [openFaq, setOpenFaq] = useState(0);
  const [processingPlan, setProcessingPlan] = useState<BillingPlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.loggedIn) return;
    let ignore = false;
    void fetchSubscription().then((result) => {
      if (!ignore && result.ok) setSubscription(result.data);
    });
    return () => {
      ignore = true;
    };
  }, [user?.loggedIn]);

  const annual = billingInterval === 'annual';
  const activePlan = subscription?.plan ?? 'free';
  const teamTotal = useMemo(() => {
    const perSeat = annual ? 25188 : 2499;
    return perSeat * teamSeats;
  }, [annual, teamSeats]);

  const startCheckout = async (plan: BillingPlan) => {
    setError(null);
    setMessage(null);

    if (!user?.loggedIn) {
      onViewChange('signup');
      return;
    }

    setProcessingPlan(plan);
    const order = await createBillingOrder({ plan, billingInterval, seats: plan === 'team' ? teamSeats : 1 });
    if (order.ok === false) {
      setError(order.error);
      setProcessingPlan(null);
      return;
    }

    if (plan === 'free') {
      if ('subscription' in order.data) {
        setSubscription(order.data.subscription);
      }
      setMessage('Free plan is active on your account.');
      setProcessingPlan(null);
      return;
    }

    if (!('orderId' in order.data)) {
      setError('Razorpay order was not returned by the server.');
      setProcessingPlan(null);
      return;
    }

    const loaded = await loadRazorpayCheckout();
    if (!loaded || !window.Razorpay) {
      setError('Razorpay Checkout could not be loaded. Check your network and try again.');
      setProcessingPlan(null);
      return;
    }

    const checkout = new window.Razorpay({
      key: order.data.keyId,
      amount: order.data.amountPaise,
      currency: order.data.currency,
      name: order.data.name,
      description: order.data.description,
      order_id: order.data.orderId,
      prefill: order.data.prefill,
      theme: { color: '#1a1a1a' },
      handler: (payment) => {
        void verifyBillingPayment(payment).then((result) => {
          setProcessingPlan(null);
          if (result.ok === false) {
            setError(result.error);
            return;
          }
          setSubscription(result.data);
          setMessage(`${plan === 'team' ? 'Team' : 'Pro'} is active. Your account limits are updated.`);
        });
      },
      modal: {
        ondismiss: () => setProcessingPlan(null),
      },
    });

    checkout.open();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <nav className="sticky top-0 z-40 border-b border-blueprint-line bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-360 items-center justify-between px-4 sm:px-8 lg:px-12">
          <button type="button" onClick={() => onViewChange('landing')} className="font-serif text-3xl leading-none text-primary">
            Repoid
          </button>
          <div className="hidden items-center gap-6 md:flex">
            <button type="button" onClick={() => onViewChange('workflows')} className="text-ui-label text-blueprint-muted transition-colors hover:text-primary">Practice</button>
            <button type="button" onClick={() => onViewChange('questionBank')} className="text-ui-label text-blueprint-muted transition-colors hover:text-primary">Question Bank</button>
            <span className="text-ui-label text-primary">Pricing</span>
          </div>
          <button
            type="button"
            onClick={() => onViewChange(user?.loggedIn ? 'dashboard' : 'signup')}
            className="rounded-full bg-primary px-5 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031]"
          >
            {user?.loggedIn ? 'Dashboard' : 'Sign Up'}
          </button>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-360 flex-col gap-14 px-4 py-10 sm:px-8 lg:px-12">
        <section className="grid gap-8 border-b border-blueprint-line pb-10 lg:grid-cols-[minmax(0,0.95fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-ui-label text-blueprint-muted">Pricing</p>
            <h1 className="mt-3 text-display-xl text-primary">Get interview-ready. On your terms.</h1>
            <p className="mt-4 text-body-lg text-blueprint-muted">
              Free to start, Pro for serious prep, Team for cohorts. Payments are handled through Razorpay and verified on the server before plan limits change.
            </p>
          </div>

          <div className="flex w-fit items-center gap-3 rounded-full border border-blueprint-line bg-card p-1">
            {(['monthly', 'annual'] as BillingInterval[]).map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setBillingInterval(interval)}
                className={cn(
                  'rounded-full px-4 py-2 text-ui-label transition-colors',
                  billingInterval === interval ? 'bg-primary text-white' : 'text-blueprint-muted hover:text-primary',
                )}
              >
                {interval === 'monthly' ? 'Monthly' : 'Annual'}
              </button>
            ))}
            <span className={cn('mr-2 rounded-md px-2 py-1 text-technical-mono', annual ? 'bg-[#e1f5ee] text-[#0f6e56]' : 'bg-[#efeded] text-blueprint-muted')}>
              Save
            </span>
          </div>
        </section>

        {(message || error) ? (
          <div className={cn('rounded-xl border px-4 py-3 text-body-md', error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#9fe1cb] bg-[#e1f5ee] text-[#0f6e56]')}>
            {error ?? message}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-3">
          {PLAN_DETAILS.map((plan) => {
            const Icon = plan.icon;
            const featured = plan.id === 'pro';
            const price = annual ? plan.annual : plan.monthly;
            const isCurrent = Boolean(user?.loggedIn) && activePlan === plan.id;
            return (
              <article key={plan.id} className={cn('surface-card relative flex min-h-[520px] flex-col', featured && 'border-primary')}>
                {featured ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md bg-primary px-4 py-1 text-technical-mono text-white">
                    Most popular
                  </div>
                ) : null}
                <div className={cn('mb-5 flex h-11 w-11 items-center justify-center rounded-lg', plan.accent)}>
                  <Icon size={20} />
                </div>
                <p className="text-ui-label text-blueprint-muted">{plan.name}</p>
                <h2 className="mt-3 text-headline-lg text-primary not-italic">
                  {price}
                  {plan.id === 'team' ? <span className="ml-2 text-body-md text-blueprint-muted">/ user</span> : plan.id === 'pro' ? <span className="ml-2 text-body-md text-blueprint-muted">{annual ? '/ year' : '/ mo'}</span> : null}
                </h2>
                {plan.id === 'team' && annual ? <p className="mt-1 text-technical-mono text-blueprint-muted">₹2,099/user/mo billed annually</p> : null}
                <p className="mt-3 min-h-12 text-body-md text-blueprint-muted">{plan.description}</p>
                <p className="mt-2 text-technical-mono text-blueprint-muted">{plan.helper}</p>

                {plan.id === 'team' ? (
                  <div className="mt-5 flex items-center justify-between rounded-lg border border-blueprint-line bg-[#efeded] px-4 py-3">
                    <span className="text-ui-label text-primary">Seats</span>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label="Decrease seats" onClick={() => setTeamSeats((value) => Math.max(3, value - 1))} className="h-8 w-8 rounded-full border border-blueprint-line bg-card text-primary">-</button>
                      <span className="w-6 text-center text-ui-label text-primary">{teamSeats}</span>
                      <button type="button" aria-label="Increase seats" onClick={() => setTeamSeats((value) => value + 1)} className="h-8 w-8 rounded-full border border-blueprint-line bg-card text-primary">+</button>
                    </div>
                  </div>
                ) : null}

                {plan.id === 'team' ? <p className="mt-3 text-technical-mono text-blueprint-muted">Total: ₹{teamTotal.toLocaleString('en-IN')}{annual ? '/year' : '/month'}</p> : null}

                <div className="my-6 h-px bg-blueprint-line" />
                <ul className="flex flex-1 flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-body-md text-primary">
                      <Check size={17} className="mt-1 shrink-0 text-[#0f6e56]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.mutedFeatures?.map((feature) => (
                    <li key={feature} className="flex gap-3 text-body-md text-blueprint-muted">
                      <X size={16} className="mt-1 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={processingPlan !== null || isCurrent}
                  onClick={() => void startCheckout(plan.id)}
                  className={cn(
                    'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-ui-label transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    featured ? 'bg-primary text-white hover:bg-[#303031]' : 'border border-blueprint-line bg-card text-primary hover:bg-[#f5f3f3]',
                  )}
                >
                  {isCurrent ? 'Current plan' : processingPlan === plan.id ? 'Opening Razorpay...' : plan.id === 'free' ? 'Start Free' : `Upgrade to ${plan.name}`}
                  {!isCurrent ? <ArrowRight size={15} /> : null}
                </button>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 border-y border-blueprint-line py-10 lg:grid-cols-4">
          {[
            { icon: CreditCard, title: 'Razorpay checkout', body: 'Orders are created server-side and verified with Razorpay signatures before access changes.' },
            { icon: Layers3, title: 'Feature gates', body: 'Plan limits are exposed through the billing API for question bank, rounds, reports, and repo scans.' },
            { icon: ShieldCheck, title: 'No Stripe dependency', body: 'Billing uses Razorpay keys, Razorpay orders, and Razorpay payment verification only.' },
            { icon: FileText, title: 'Prep-first limits', body: 'Plans map to real product value: domains, tracks, coding rounds, mocks, GitHub repos, and reports.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="border-l border-blueprint-line pl-5">
                <Icon size={22} className="text-primary" />
                <h3 className="mt-4 text-ui-label text-primary">{item.title}</h3>
                <p className="mt-2 text-body-md text-blueprint-muted">{item.body}</p>
              </article>
            );
          })}
        </section>

        <section>
          <div className="mb-6 max-w-2xl">
            <p className="text-ui-label text-blueprint-muted">Full comparison</p>
            <h2 className="mt-2 text-headline-lg text-primary">Every plan limit in one place.</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-blueprint-line bg-card">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-blueprint-line">
                  <th className="px-5 py-4 text-ui-label text-blueprint-muted">Feature</th>
                  <th className="px-5 py-4 text-center text-ui-label text-blueprint-muted">Free</th>
                  <th className="px-5 py-4 text-center text-ui-label text-[#0f6e56]">Pro</th>
                  <th className="px-5 py-4 text-center text-ui-label text-[#534ab7]">Team</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, index) => (
                  row.category ? (
                    <tr key={row.category} className="border-b border-blueprint-line bg-[#efeded]">
                      <td colSpan={4} className="px-5 py-3 text-technical-mono text-blueprint-muted">{row.category}</td>
                    </tr>
                  ) : (
                    <tr key={`${row.feature}-${index}`} className="border-b border-blueprint-line last:border-b-0">
                      <td className="px-5 py-4 text-body-md text-primary">{row.feature}</td>
                      <td className="px-5 py-4 text-center"><FeatureValue value={row.free} /></td>
                      <td className="px-5 py-4 text-center"><FeatureValue value={row.pro} /></td>
                      <td className="px-5 py-4 text-center"><FeatureValue value={row.team} /></td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.7fr_1fr]">
          <div>
            <p className="text-ui-label text-blueprint-muted">Common questions</p>
            <h2 className="mt-2 text-headline-lg text-primary">Billing without surprises.</h2>
          </div>
          <div className="divide-y divide-blueprint-line border-y border-blueprint-line">
            {FAQS.map((faq, index) => {
              const open = openFaq === index;
              return (
                <button key={faq.question} type="button" onClick={() => setOpenFaq(open ? -1 : index)} className="w-full py-5 text-left">
                  <span className="flex items-center justify-between gap-4 text-body-lg font-semibold text-primary">
                    {faq.question}
                    <ChevronDown size={18} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
                  </span>
                  {open ? <span className="mt-3 block text-body-md text-blueprint-muted">{faq.answer}</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
