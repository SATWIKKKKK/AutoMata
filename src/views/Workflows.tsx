import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPANY_TYPE_LABELS, DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';

type PracticeTrack = {
  id: string;
  name: string;
  duration: string;
  icon: string;
  pattern: string;
  focus: string[];
  insight: string;
};

const TRACKS_BY_DOMAIN: Record<string, PracticeTrack[]> = {
  frontend: [
    {
      id: 'frontend-machine-coding',
      name: 'Frontend Machine Coding Session',
      duration: '45 Min',
      icon: 'web',
      pattern: 'Build a UI feature, explain state transitions, and talk through edge cases under time pressure.',
      focus: ['State flow', 'Async UI', 'Rendering performance'],
      insight: 'Interviewers want stable UI behavior first. Fancy abstractions matter less than clear state and error handling.',
    },
    {
      id: 'react-debugging',
      name: 'React Debugging Round',
      duration: '30 Min',
      icon: 'bug_report',
      pattern: 'Find the bug, explain the root cause, and say how you would test the fix.',
      focus: ['Effects', 'Stale state', 'Race conditions'],
      insight: 'You score better here when you explain the failure before you jump into the patch.',
    },
    {
      id: 'project-walkthrough',
      name: 'Project Walkthrough Round',
      duration: '20 Min',
      icon: 'account_tree',
      pattern: 'Tell the story of one project, why you built it that way, and what you would change next.',
      focus: ['Tradeoffs', 'Architecture', 'Ownership'],
      insight: 'This is where weak project storytelling gets exposed. Keep the problem, decision, and result very clear.',
    },
  ],
  backend: [
    {
      id: 'api-design',
      name: 'API Design Round',
      duration: '45 Min',
      icon: 'dns',
      pattern: 'Design the endpoint, handle failures, and explain how you keep writes safe under retries.',
      focus: ['Contracts', 'Idempotency', 'Retries'],
      insight: 'A clean contract is only half the answer. Interviewers listen for failure handling and data consistency.',
    },
    {
      id: 'scenario-backend',
      name: 'Scenario-Based Backend Test',
      duration: '30 Min',
      icon: 'hub',
      pattern: 'Respond to incident-style questions around queues, rate limits, and service behavior under load.',
      focus: ['Concurrency', 'Rate limiting', 'Observability'],
      insight: 'Stay concrete. Pick one likely failure mode and show how you would detect and contain it.',
    },
    {
      id: 'backend-project',
      name: 'Project Walkthrough Round',
      duration: '20 Min',
      icon: 'account_tree',
      pattern: 'Explain service boundaries, database choices, and what you learned from production issues.',
      focus: ['Architecture', 'Scaling choices', 'Tradeoffs'],
      insight: 'This round gets stronger when you name one decision you regret and how you would fix it now.',
    },
  ],
  'full-stack': [
    {
      id: 'full-stack-build',
      name: 'Full Stack Build Round',
      duration: '50 Min',
      icon: 'deployed_code',
      pattern: 'Connect UI, API, and persistence while keeping the flow stable when requests fail.',
      focus: ['Contracts', 'Optimistic UI', 'Error states'],
      insight: 'The best answers keep the flow simple and explain what the user sees when something breaks.',
    },
    {
      id: 'debugging-round',
      name: 'Debugging Round',
      duration: '30 Min',
      icon: 'bug_report',
      pattern: 'Trace one bug across frontend, backend, and data flow before suggesting the patch.',
      focus: ['Tracing', 'State sync', 'Root cause'],
      insight: 'Do not jump between layers randomly. Move from symptom to source in a clear order.',
    },
    {
      id: 'system-project',
      name: 'Project Architecture Round',
      duration: '25 Min',
      icon: 'lan',
      pattern: 'Defend architecture choices across the client, API, and storage path.',
      focus: ['Tradeoffs', 'Boundaries', 'Ownership'],
      insight: 'You stand out here when you explain why the same problem was split across layers that way.',
    },
  ],
  'ai-ml': [
    {
      id: 'model-round',
      name: 'Model Reasoning Round',
      duration: '40 Min',
      icon: 'neurology',
      pattern: 'Explain model choice, evaluation strategy, and what failure would look like in production.',
      focus: ['Evaluation', 'Failure modes', 'Tradeoffs'],
      insight: 'A confident answer names the metric, why it mattered, and what it failed to capture.',
    },
    {
      id: 'retrieval-round',
      name: 'Retrieval Scenario Test',
      duration: '35 Min',
      icon: 'manage_search',
      pattern: 'Handle chunking, ranking, latency, and bad retrieval results without losing answer quality.',
      focus: ['Retrieval quality', 'Latency', 'Fallbacks'],
      insight: 'Interviewers want to hear how you measure retrieval quality, not just how you build it.',
    },
    {
      id: 'ml-project',
      name: 'Project Walkthrough Round',
      duration: '20 Min',
      icon: 'account_tree',
      pattern: 'Walk through your data pipeline, model iteration loop, and what blocked you most.',
      focus: ['Pipeline design', 'Iteration', 'Tradeoffs'],
      insight: 'Be precise about the dataset, evaluation loop, and what changed between versions.',
    },
  ],
};

export default function Workflows() {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const [query, setQuery] = useState('');
  const domainLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend';
  const companyTypeLabel = COMPANY_TYPE_LABELS[workspace.selections.companyType] ?? 'Product Company';

  const tracks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = TRACKS_BY_DOMAIN[workspace.selections.domain] ?? TRACKS_BY_DOMAIN.frontend;
    if (!normalized) return source;
    return source.filter((track) => (
      track.name.toLowerCase().includes(normalized)
      || track.pattern.toLowerCase().includes(normalized)
      || track.focus.some((item) => item.toLowerCase().includes(normalized))
    ));
  }, [query, workspace.selections.domain]);

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-[1440px] space-y-10">
        <section className="grid gap-4 border-b border-blueprint-line pb-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-display-xl text-primary">Practice Tracks</h1>
            <p className="mt-3 text-body-lg text-blueprint-muted">
              Pick the round you want to sharpen next. These tracks stay aligned with your {domainLabel.toLowerCase()} target and {companyTypeLabel.toLowerCase()} interview style.
            </p>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-blueprint-muted">search</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a round or focus area"
              className="w-full border-0 border-b border-blueprint-line bg-transparent py-3 pl-10 pr-4 text-body-md text-primary outline-none transition-colors placeholder:text-[#747878] focus:border-primary"
            />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {tracks.map((track) => (
            <article key={track.id} className={`rounded-xl border border-blueprint-line bg-white/85 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] ${track.id === tracks[0]?.id ? 'xl:row-span-2 flex flex-col justify-between' : ''}`}>
              <div>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#efeded] text-primary">
                      <span className="material-symbols-outlined">{track.icon}</span>
                    </div>
                    <h2 className="text-headline-lg text-primary">{track.name}</h2>
                  </div>
                  <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">{track.duration}</span>
                </div>

                <div className="space-y-6">
                  <div className="border-t border-blueprint-line pt-4">
                    <h3 className="text-ui-label text-blueprint-muted">Round Format</h3>
                    <p className="mt-2 text-body-md text-primary">{track.pattern}</p>
                  </div>
                  <div>
                    <h3 className="text-ui-label text-blueprint-muted">What This Round Checks</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {track.focus.map((tag) => (
                        <span key={tag} className="rounded-md bg-[#efeded] px-2 py-1 text-ui-label text-primary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-blueprint-line bg-[#fbf9f9] p-4">
                    <div className="mb-2 flex items-center gap-2 text-ui-label text-blueprint-muted">
                      <span className="material-symbols-outlined text-[16px]">info</span>
                      Why This Matters
                    </div>
                    <p className="text-body-md text-primary">{track.insight}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/registry')}
                className={`mt-6 w-full rounded-full border px-5 py-3 text-ui-label transition-colors ${track.id === tracks[0]?.id ? 'border-primary bg-primary text-white hover:bg-[#303031]' : 'border-blueprint-line bg-[#efeded] text-primary hover:bg-primary hover:text-white'}`}
              >
                Start Round
              </button>
            </article>
          ))}

          <button type="button" onClick={() => navigate('/builder')} className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-blueprint-line bg-transparent p-6 text-center transition-colors hover:bg-white/50">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#efeded] text-blueprint-muted">
              <span className="material-symbols-outlined text-[32px]">add</span>
            </div>
            <div>
              <h3 className="text-headline-md text-primary not-italic">Custom Track</h3>
              <p className="mt-2 max-w-[250px] text-body-md text-blueprint-muted">
                Need a different mix? Build a track from your role target and project context.
              </p>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
}