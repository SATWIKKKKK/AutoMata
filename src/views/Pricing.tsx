import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, LogOut, Settings } from 'lucide-react';
import { View } from '../App';
import { cn } from '../lib/utils';
import { clearSessionState, getStoredUser } from '../lib/session';
function getInitials(name?: string, email?: string) {
  if (name) return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return 'U';
}

interface PricingProps {
  onViewChange: (view: View) => void;
}

export default function Pricing({ onViewChange }: PricingProps) {
  const user = getStoredUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = () => {
    clearSessionState();
    setDropdownOpen(false);
    onViewChange('landing');
    window.location.reload();
  };

  return (
    <div
      className="text-on-surface antialiased flex flex-col min-h-screen"
      style={{
        backgroundColor: '#fbf9f9',
        backgroundImage:
          'linear-gradient(to right, #e4e2e2 1px, transparent 1px), linear-gradient(to bottom, #e4e2e2 1px, transparent 1px)',
        backgroundSize: '4rem 4rem',
      }}
    >
      {/* ── Nav ── */}
      <nav className="sticky top-0 w-full z-50 border-b border-blueprint-line bg-white/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto flex items-center px-4 md:px-8 h-16 w-full relative">
          {/* Logo */}
          <div className="flex-shrink-0 z-10">
            <button
              onClick={() => onViewChange('landing')}
              className="font-serif italic text-2xl md:text-3xl text-primary tracking-tight"
            >
              AUTOMATA
            </button>
          </div>

          {/* Centre nav */}
          <div className="hidden lg:flex items-center gap-6 absolute left-1/2 -translate-x-1/2 z-0">
            <button onClick={() => onViewChange('workflows')} className="text-ui-label text-blueprint-muted hover:text-primary transition-colors whitespace-nowrap">Workflows</button>
            <button onClick={() => onViewChange('docs')} className="text-ui-label text-blueprint-muted hover:text-primary transition-colors whitespace-nowrap">Docs</button>
            <button className="text-ui-label text-primary font-semibold border-b border-primary pb-0.5 whitespace-nowrap">Pricing</button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 md:gap-4 ml-auto z-10">
            {user?.loggedIn ? (
              <>
                <button
                  onClick={() => onViewChange('builder')}
                  className="bg-primary text-on-primary px-4 md:px-6 py-2 md:py-2.5 rounded-full text-ui-label hover:bg-inverse-surface transition-all font-medium whitespace-nowrap"
                >
                  Dashboard
                </button>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-1.5 focus:outline-none"
                  >
                    <div className="w-8 h-8 rounded-full border border-gray-200 bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                      {getInitials(user?.name, user?.email)}
                    </div>
                    <ChevronDown size={14} className={cn('text-gray-500 transition-transform', dropdownOpen && 'rotate-180')} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-10 min-w-[180px] bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50">
                      {user?.name && <p className="px-4 py-1 text-sm font-semibold truncate">{user.name}</p>}
                      {user?.email && <p className="px-4 pb-2 text-xs text-gray-400 truncate border-b border-gray-100">{user.email}</p>}
                      <button onClick={() => { setDropdownOpen(false); onViewChange('settings'); }}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <Settings size={14} className="text-gray-400" /> Settings
                      </button>
                      <button onClick={handleSignOut}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <LogOut size={14} className="text-gray-400" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => onViewChange('auth')}
                  className="text-ui-label font-medium text-on-background px-2 md:px-4 hover:text-primary transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => onViewChange('signup')}
                  className="bg-primary text-on-primary px-4 md:px-6 py-2 md:py-2.5 rounded-full text-ui-label hover:bg-inverse-surface transition-all font-medium whitespace-nowrap"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="grow pb-16 sm:pb-24 relative z-10">

        {/* Hero */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-16 pt-12 sm:pt-16 pb-16 sm:pb-24 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="font-ui-label text-ui-label uppercase text-on-surface-variant block mb-6 tracking-widest">
              Pricing
            </span>
            <h1 className="font-display-xl text-display-xl text-primary mb-8 max-w-4xl mx-auto">
              Scale your autonomous operations.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              Predictable, usage-based pricing designed for technical teams. Pay only for the
              computational resources and active execution hours your AI agents consume.
            </p>
          </motion.div>
        </section>

        {/* Pricing Cards */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-16 mb-20 sm:mb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

            {/* Starter */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sm:p-10 flex flex-col h-full shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow duration-300"
            >
              <div className="mb-8">
                <h2 className="font-headline-md text-headline-md text-primary mb-2">Starter</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">For exploring autonomous capabilities.</p>
              </div>
              <div className="mb-8">
                <span className="font-display-xl text-display-xl text-primary">₹0</span>
                <span className="font-body-md text-body-md text-on-surface-variant">/month</span>
              </div>
              <ul className="grow space-y-4 mb-8">
                {['3 active workflows', '500 node executions / month', 'SQLite local storage', 'Community support', 'Basic analytics'].map(f => (
                  <li key={f} className="flex items-start gap-3">
                    <Check size={18} className="text-outline mt-0.5 shrink-0" />
                    <span className="font-body-md text-body-md text-on-surface">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onViewChange('signup')}
                className="w-full text-center py-3 border border-outline-variant rounded-full font-ui-label text-ui-label text-primary hover:bg-surface-container transition-colors"
              >
                Start Free
              </button>
            </motion.div>

            {/* Professional */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              className="bg-surface-container-lowest border border-primary rounded-xl p-6 sm:p-10 flex flex-col h-full shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.1)] transition-shadow duration-300 relative md:-translate-y-4"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 rounded-full font-technical-mono text-technical-mono uppercase whitespace-nowrap">
                Most Popular
              </div>
              <div className="mb-8 mt-2">
                <h2 className="font-headline-md text-headline-md text-primary mb-2">Professional</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">For production-grade autonomous systems.</p>
              </div>
              <div className="mb-8">
                <span className="font-display-xl text-display-xl text-primary">₹999</span>
                <span className="font-body-md text-body-md text-on-surface-variant">/month</span>
              </div>
              <ul className="grow space-y-4 mb-8">
                {[
                  'Unlimited workflows',
                  '50,000 node executions / month',
                  'Claude + Gemini LLM access',
                  'Gmail, Sheets, Slack integrations',
                  'Priority email support',
                  'Advanced analytics',
                  'Webhook triggers',
                ].map(f => (
                  <li key={f} className="flex items-start gap-3">
                    <Check size={18} className="text-primary mt-0.5 shrink-0" />
                    <span className="font-body-md text-body-md text-on-surface font-medium">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onViewChange('signup')}
                className="w-full text-center py-3 bg-primary text-on-primary rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors"
              >
                Get Started
              </button>
            </motion.div>

            {/* Enterprise */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sm:p-10 flex flex-col h-full shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow duration-300"
            >
              <div className="mb-8">
                <h2 className="font-headline-md text-headline-md text-primary mb-2">Enterprise</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">For organisations requiring unlimited scale.</p>
              </div>
              <div className="mb-8">
                <span className="font-headline-lg text-headline-lg text-primary block leading-none">Custom</span>
                <span className="font-body-md text-body-md text-on-surface-variant block mt-4">Volume-based pricing</span>
              </div>
              <ul className="grow space-y-4 mb-8">
                {[
                  'Unlimited operator execution hours',
                  'Advanced custom MCP integrations',
                  'Predictive anomaly detection',
                  'Dedicated technical account manager',
                  'On-premise deployment options',
                  'SSO + RBAC + Audit logs',
                  '99.99% SLA',
                ].map(f => (
                  <li key={f} className="flex items-start gap-3">
                    <Check size={18} className="text-outline mt-0.5 shrink-0" />
                    <span className="font-body-md text-body-md text-on-surface">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onViewChange('auth')}
                className="w-full text-center py-3 border border-outline-variant rounded-full font-ui-label text-ui-label text-primary hover:bg-surface-container transition-colors"
              >
                Contact Sales
              </button>
            </motion.div>

          </div>

          <p className="text-center text-on-surface-variant text-xs mt-10 font-mono">
            Razorpay payment integration coming soon. All prices are in INR and exclude GST.
          </p>
        </section>

        {/* Core Capabilities */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-16 border-t border-surface-variant pt-16 sm:pt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            <div className="lg:col-span-4">
              <h3 className="font-headline-lg text-headline-lg text-primary mb-6">Core Capabilities</h3>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Our platform is engineered for precision and scale. Understand the technical metrics that drive our pricing model.
              </p>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-16">
              {[
                {
                  icon: '⏱',
                  title: 'Operator Execution Hours',
                  body: 'Compute time measured precisely down to the millisecond. Execution hours account for active processing time only — you pay for actual computational effort rather than idle standby time.',
                },
                {
                  icon: '🔌',
                  title: 'Custom MCP Integrations',
                  body: 'Leverage the Model Context Protocol to seamlessly connect Automata with proprietary internal tools. Professional and Enterprise tiers include dedicated support for deploying bespoke MCP servers.',
                },
                {
                  icon: '📊',
                  title: 'Anomaly Detection',
                  body: 'Built-in observability monitors agent behaviour against established baseline patterns. The system automatically halts execution and flags human operators if agentic actions deviate from expected parameters.',
                },
                {
                  icon: '🔐',
                  title: 'Credential Security',
                  body: 'API keys and OAuth tokens are encrypted at rest using per-tenant Fernet keys. Decryption only occurs inside isolated worker processes — keys are never logged or exposed in API responses.',
                },
              ].map(feat => (
                <div key={feat.title}>
                  <div className="w-12 h-12 bg-surface-container-highest rounded-full flex items-center justify-center mb-6 text-xl">
                    {feat.icon}
                  </div>
                  <h4 className="font-ui-label text-ui-label text-primary uppercase tracking-widest mb-3">{feat.title}</h4>
                  <p className="font-body-md text-body-md text-on-surface-variant">{feat.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full mt-16 sm:mt-24 bg-[#fbf9f9] border-t border-outline-variant">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-16 py-10 sm:py-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <button
              onClick={() => onViewChange('landing')}
              className="font-serif text-xl text-primary tracking-tighter"
            >
              AUTOMATA
            </button>
            <span className="text-xs uppercase tracking-widest text-on-surface-variant">
              © 2026 Automata. Autonomous Intelligence.
            </span>
          </div>
          <ul className="flex flex-wrap justify-center gap-6 text-xs uppercase tracking-widest">
            {([
              { label: 'Privacy Policy', view: 'privacy' },
              { label: 'Terms of Service', view: 'terms' },
              { label: 'Security', view: 'security' },
            ] as { label: string; view: View }[]).map(({ label, view }) => (
              <li key={view}>
                <button
                  onClick={() => onViewChange(view)}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
