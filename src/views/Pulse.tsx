import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredPrepWorkspace } from '../lib/prep';

export default function Pulse() {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const focusAreas = workspace.prepPlan?.focusAreas.slice(0, 3) ?? ['Component architecture', 'State flow', 'Project storytelling'];
  const weakPoints = workspace.repoAnalysis?.weakPoints ?? workspace.manualAnalysis?.gapsThatMightExist ?? ['You still lose time on async state changes.', 'Your project tradeoff story needs a cleaner opening.'];
  const threeDayPlan = workspace.prepPlan?.prepStrategy['3-day'].length
    ? workspace.prepPlan.prepStrategy['3-day'].slice(0, 3)
    : [
        'Repeat one short debugging round on the same weak topic.',
        'Practice the project story with a clearer problem, decision, and result.',
        'Run one timed re-test and compare the explanation quality, not just the score.',
      ];

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360 space-y-8">
        <header className="flex flex-col gap-6 border-b border-blueprint-line pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => navigate('/mock-interview')} className="text-blueprint-muted transition-colors hover:text-primary">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <p className="text-ui-label text-blueprint-muted">Session Feedback</p>
              <h1 className="mt-1 text-display-xl text-primary">What To Fix Next</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full border border-blueprint-line bg-white px-6 py-2 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
              Save Summary
            </button>
            <button type="button" onClick={() => navigate('/practice-tracks')} className="rounded-full bg-primary px-6 py-2 text-ui-label text-white transition-colors hover:bg-[#303031]">
              Back to Tracks
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <article className="rounded-3xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] lg:col-span-4">
            <div className="mb-8 text-right">
              <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">Round Score</span>
            </div>
            <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-full border-4 border-blueprint-line">
              <div className="absolute inset-0 rounded-full border-4 border-primary border-r-transparent border-t-transparent -rotate-45" />
              <div className="text-center">
                <span className="block text-display-xl text-primary leading-none">78<span className="text-headline-md">%</span></span>
                <span className="mt-2 block text-ui-label text-blueprint-muted">Interview Match</span>
              </div>
            </div>
            <p className="mt-8 text-center text-body-md text-blueprint-muted">
              You are already stable on {focusAreas[0]}. The next jump comes from fixing {weakPoints[0].toLowerCase()} before the next timed round.
            </p>
          </article>

          <div className="flex flex-col gap-6 lg:col-span-8">
            <article className="rounded-3xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <h2 className="mb-6 text-headline-md text-primary not-italic">Competency Breakdown</h2>
              <div className="space-y-6">
                {[
                  [focusAreas[0], '92%', 'w-[92%]'],
                  [focusAreas[1] ?? 'Project storytelling', '85%', 'w-[85%]'],
                  [weakPoints[0], '45%', 'w-[45%]'],
                ].map(([label, value, widthClass]) => (
                  <div key={label}>
                    <div className="mb-2 flex items-center justify-between text-body-md text-primary"><span>{label}</span><span>{value}</span></div>
                    <div className="h-2 w-full rounded-full bg-blueprint-line"><div className={`h-full rounded-full bg-primary ${widthClass}`} /></div>
                  </div>
                ))}
              </div>
            </article>

            <div className="grid gap-6 md:grid-cols-2">
              <article className="rounded-xl border border-blueprint-line bg-[#f5f3f3] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#ba1a1a]">error</span>
                  <h3 className="text-ui-label text-primary">Critical Gap</h3>
                </div>
                <h4 className="text-body-lg font-semibold text-primary">{weakPoints[0]}</h4>
                <p className="mt-2 text-body-md text-blueprint-muted">
                  This is the place where your answer gets less clear under pressure. Slow down, name the failure, and show the smallest fix first.
                </p>
              </article>
              <article className="rounded-xl border border-blueprint-line bg-[#f5f3f3] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <h3 className="text-ui-label text-primary">Strong Point</h3>
                </div>
                <h4 className="text-body-lg font-semibold text-primary">{focusAreas[0]}</h4>
                <p className="mt-2 text-body-md text-blueprint-muted">
                  Keep this strong, but do not spend your longest practice block here. Use it as the stable part of your answer, then move to the harder follow-up.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <div className="mb-8 flex flex-col gap-4 border-b border-blueprint-line pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-ui-label text-blueprint-muted">Your Next 3 Days</span>
              <h2 className="mt-1 text-headline-lg text-primary">Follow-Up Plan</h2>
            </div>
            <button type="button" onClick={() => navigate('/practice-tracks')} className="text-ui-label text-primary transition-colors hover:text-blueprint-muted">
              View All Tracks
            </button>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {threeDayPlan.map((item, index) => (
              <div key={item} className="relative border-l border-blueprint-line pl-6">
                <span className={`absolute -left-[6px] top-1 h-3 w-3 rounded-full ${index === 0 ? 'bg-primary' : 'border border-blueprint-line bg-[#efeded]'}`} />
                <div className="text-ui-label text-blueprint-muted">Day {index + 1}</div>
                <h3 className="mt-2 text-body-lg font-semibold text-primary">{index === 0 ? 'Fix the repeated miss' : index === 1 ? 'Tighten the project story' : 'Re-test the round'}</h3>
                <div className="mt-4 space-y-3 text-body-md text-blueprint-muted">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px]">arrow_right_alt</span>
                    <span>{item}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
