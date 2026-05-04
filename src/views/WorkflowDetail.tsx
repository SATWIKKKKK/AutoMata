import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QuizModule } from '../components/ModulePlaceholders';
import { COMPANY_TYPE_LABELS, DOMAIN_LABELS, getStoredPrepWorkspace, INTERVIEW_TYPE_LABELS } from '../lib/prep';

export default function WorkflowDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const workspace = getStoredPrepWorkspace();
  const plan = workspace.prepPlan;
  const focusAreas = plan?.focusAreas.slice(0, 2) ?? ['Component architecture', 'Async state handling'];
  const weakAreas = workspace.repoAnalysis?.weakPoints ?? workspace.manualAnalysis?.gapsThatMightExist ?? ['You slowed down when state and timing changed together.', 'Your project answers need sharper tradeoff language.'];
  const threeDayPlan = plan?.prepStrategy['3-day'].length
    ? plan.prepStrategy['3-day'].slice(0, 3)
    : [
        'Repeat one short debugging round and speak the root cause out loud.',
        'Practice one project walkthrough with a tighter architecture story.',
        'Take one timed re-test on the same weak topic.',
      ];
  const breakdown = [
    { label: focusAreas[0], value: '88%', bar: 'bg-primary w-[88%]' },
    { label: focusAreas[1] ?? 'Project walkthrough', value: '81%', bar: 'bg-primary w-[81%]' },
    { label: weakAreas[0], value: '44%', bar: 'bg-[#5d5f5d] w-[44%]' },
    { label: weakAreas[1] ?? 'Follow-up depth', value: '37%', bar: 'bg-[#5d5f5d] w-[37%]' },
  ];
  const feedback = [
    {
      tag: focusAreas[0],
      title: 'Keep your opening explanation crisp',
      body: 'You already answer this area well. The next gain comes from stating the tradeoff before you write or change code.',
    },
    {
      tag: weakAreas[0],
      title: 'Slow down when the requirement shifts',
      body: 'This is where your answers become less structured. Restate the failure, pick one fix path, then mention the test you would run.',
    },
  ];

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360 space-y-8">
        <header className="flex flex-col gap-6 border-b border-blueprint-line pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-ui-label text-blueprint-muted">Session Feedback</p>
            <h1 className="mt-2 text-display-xl text-primary">What Changed In This Round</h1>
            <p className="mt-3 text-body-md text-blueprint-muted">
              {DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend'} • {INTERVIEW_TYPE_LABELS[workspace.selections.interviewType] ?? 'Interview'} • {COMPANY_TYPE_LABELS[workspace.selections.companyType] ?? 'Product Company'} • Session {id ?? 'PROMPTLY-SESSION'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full border border-blueprint-line bg-white px-6 py-2 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
              Save Notes
            </button>
            <button type="button" onClick={() => navigate('/pulse')} className="rounded-full bg-primary px-6 py-2 text-ui-label text-white transition-colors hover:bg-[#303031]">
              Open 3-Day Plan
            </button>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-12">
          <article className="rounded-xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:col-span-4">
            <h2 className="text-ui-label text-blueprint-muted">Round Summary</h2>
            <div className="relative mx-auto mt-8 flex h-56 w-56 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e4e2e2" strokeWidth="6" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="#000000" strokeDasharray="339.292" strokeDashoffset="84.823" strokeLinecap="round" strokeWidth="6" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-headline-lg text-primary">75%</span>
                <span className="text-ui-label text-blueprint-muted">Interview Fit</span>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-blueprint-line pt-6">
              <div>
                <div className="text-ui-label text-blueprint-muted">Strong Answers</div>
                <div className="mt-1 text-body-lg text-primary">12 / 15</div>
              </div>
              <div>
                <div className="text-ui-label text-blueprint-muted">Time Control</div>
                <div className="mt-1 text-body-lg text-primary">82%</div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:col-span-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <h2 className="text-ui-label text-blueprint-muted">What Felt Strong vs Shaky</h2>
              <span className="material-symbols-outlined text-blueprint-muted">tune</span>
            </div>
            <div className="space-y-6">
              {breakdown.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <span className="text-body-md text-primary">{item.label}</span>
                    <span className="text-ui-label text-blueprint-muted">{item.value}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-blueprint-line">
                    <div className={`h-full rounded-full ${item.bar}`} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:col-span-6">
            <h2 className="mb-6 text-ui-label text-blueprint-muted">Targeted Feedback</h2>
            <div className="space-y-6">
              {feedback.map((item) => (
                <div key={item.title} className="border-l-2 border-primary pl-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded border border-blueprint-line bg-[#efeded] px-2 py-1 text-ui-label text-primary">{item.tag}</span>
                    <h3 className="text-body-md font-medium text-primary">{item.title}</h3>
                  </div>
                  <p className="text-body-md text-blueprint-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:col-span-6">
            <h2 className="mb-8 text-ui-label text-blueprint-muted">3-Day Follow-Up Plan</h2>
            <div className="relative ml-3 space-y-8 border-l border-blueprint-line">
              {threeDayPlan.map((body, index) => (
                <div key={body} className="relative pl-8">
                  <span className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${index === 0 ? 'bg-primary' : 'border border-blueprint-line bg-[#efeded]'}`} />
                  <div className="text-ui-label text-blueprint-muted">Day {index + 1}</div>
                  <h3 className="mt-1 text-body-md font-medium text-primary">{index === 0 ? 'Fix the most repeated miss' : index === 1 ? 'Tighten the explanation' : 'Re-test under time pressure'}</h3>
                  <p className="mt-1 text-body-md text-blueprint-muted">{body}</p>
                </div>
              ))}
            </div>
          </article>

          <QuizModule className="md:col-span-12" />
        </section>
      </main>
    </div>
  );
}