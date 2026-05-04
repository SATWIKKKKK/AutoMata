import React from 'react';
import { GapAnalysisDashboard } from '../components/ModulePlaceholders';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';

export default function Analytics() {
  const workspace = getStoredPrepWorkspace();
  const domainLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend';
  const focusAreas = workspace.prepPlan?.focusAreas.slice(0, 4) ?? ['Async state handling', 'Project storytelling', 'Edge-case coverage'];
  const weakPoints = workspace.repoAnalysis?.weakPoints ?? workspace.manualAnalysis?.gapsThatMightExist ?? ['You slow down when requirements change mid-round.', 'Your project explanation needs cleaner tradeoff language.', 'You need a tighter answer for edge cases.'];
  const feedbackItems = [
    weakPoints[0],
    weakPoints[1] ?? 'Keep one short debugging round in the weekly mix.',
    workspace.repoAnalysis?.improvementSuggestions?.[0] ?? workspace.manualAnalysis?.projectSpecificQuestions?.[0] ?? 'Repeat one project walkthrough and tighten the opening story.',
  ];

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360 space-y-10">
        <header>
          <h1 className="text-headline-lg text-primary">Gap Review</h1>
          <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
            Use this page to spot what keeps slowing you down in {domainLabel.toLowerCase()} rounds and decide what to repeat next.
          </p>
        </header>

        <section className="rounded-xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-blueprint-line pb-4">
            <h2 className="text-ui-label text-primary">Progress Across Practice Blocks</h2>
            <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">Last 4 Sessions</span>
          </div>
          <GapAnalysisDashboard className="border-0 bg-transparent p-0 shadow-none" />
          <div className="mt-4 flex justify-between text-ui-label text-blueprint-muted">
            <span>Block 1</span>
            <span>Block 2</span>
            <span>Block 3</span>
            <span>Block 4</span>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-xl border border-blueprint-line bg-white/85 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] lg:col-span-2">
            <h2 className="mb-6 text-ui-label text-primary">Topics to Revisit</h2>
            <div className="space-y-6">
              {focusAreas.map((label, index) => {
                const widths = ['w-[78%]', 'w-[65%]', 'w-[54%]', 'w-[43%]'];
                const values = ['78%', '65%', '54%', '43%'];
                return (
                  <div key={label}>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <span className="text-body-md text-primary">{label}</span>
                      <span className="text-ui-label text-blueprint-muted">{values[index] ?? '50%'}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-blueprint-line">
                      <div className={`h-full rounded-full bg-primary ${widths[index] ?? 'w-[50%]'}`} />
                    </div>
                    <div className="mt-2 text-right">
                      <button className="text-ui-label text-blueprint-muted transition-colors hover:text-primary">
                        Open Drill
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-xl border border-blueprint-line bg-white/85 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-ui-label text-primary">Session Feedback</h2>
              <span className="material-symbols-outlined text-blueprint-muted">visibility</span>
            </div>
            <div className="space-y-4">
              {feedbackItems.map((body, index) => (
                <div key={body} className="rounded-lg border border-blueprint-line bg-[#fbf9f9] p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary">{index === 0 ? 'warning' : 'info'}</span>
                    <div>
                      <p className="text-ui-label text-primary">{index === 0 ? 'Needs Attention' : index === 1 ? 'Keep Practicing' : 'Next Session Prompt'}</p>
                      <p className="mt-1 text-body-md text-blueprint-muted">{body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}