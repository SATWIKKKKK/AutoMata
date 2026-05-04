import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveCodingSession } from '../components/ModulePlaceholders';
import { getStoredPrepWorkspace } from '../lib/prep';
import { View } from '../App';

interface TerminalPageProps {
  onViewChange: (view: View) => void;
}

const ROUND_CONTEXT: Record<string, { prompt: string; followUp: string; fileName: string; notes: string[] }> = {
  frontend: {
    prompt: 'Your search UI occasionally shows stale results. Walk through the root cause, then explain the smallest fix you trust under time pressure.',
    followUp: 'Be explicit about cancellation, stale state, and how you would prove the fix works.',
    fileName: 'SearchResults.tsx',
    notes: ['You named the symptom quickly.', 'Push harder on why stale requests still reach state.', 'End with the exact test you would write.'],
  },
  backend: {
    prompt: 'A payment webhook is retried three times and duplicate side effects are leaking through. Explain your fix and the guard you would add first.',
    followUp: 'Be explicit about idempotency keys, persistence order, and how retries stay safe.',
    fileName: 'paymentWebhook.ts',
    notes: ['You identified the duplicate-write risk.', 'State the source of truth before you describe the queue.', 'Name one safe retry boundary.'],
  },
  'full-stack': {
    prompt: 'The UI shows a successful save before the backend write fails. Explain how you would realign the client and server without confusing the user.',
    followUp: 'Cover optimistic updates, rollback behavior, and how you would prevent duplicate writes.',
    fileName: 'CheckoutFlow.ts',
    notes: ['You explained the user impact clearly.', 'Keep the mutation path linear.', 'Call out the rollback state before the retry path.'],
  },
  'ai-ml': {
    prompt: 'The retriever keeps sending weak context to the model. Explain how you would stop low-signal chunks from hurting answer quality.',
    followUp: 'Cover ranking, confidence thresholds, fallback behavior, and how you would measure the improvement.',
    fileName: 'retrievalPipeline.py',
    notes: ['You named retrieval quality as the real issue.', 'Keep the metric tied to one failure mode.', 'End with the evaluation loop you would trust.'],
  },
};

export default function TerminalPage(_props: TerminalPageProps) {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const context = ROUND_CONTEXT[workspace.selections.domain] ?? ROUND_CONTEXT.frontend;

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto flex h-full w-full max-w-360 flex-col gap-6">
        <header className="flex items-center justify-between rounded-xl border border-blueprint-line bg-white/80 p-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)]">
          <div>
            <h1 className="text-headline-md text-primary not-italic">Mock Interview Round</h1>
            <p className="mt-1 text-body-md text-blueprint-muted">Answer clearly, then explain the tradeoff behind your fix.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-blueprint-line bg-[#efeded] px-3 py-1.5 text-ui-label text-primary">
              <span className="h-2 w-2 rounded-full bg-[#ba1a1a]" /> Live Round
            </div>
            <div className="flex items-center gap-2 text-ui-label text-primary">
              <span className="material-symbols-outlined text-[18px]">timer</span>
              24:12
            </div>
          </div>
        </header>

        <section className="grid min-h-[720px] gap-6 lg:grid-cols-[280px_1fr_280px]">
          <aside className="flex flex-col overflow-hidden rounded-xl border border-blueprint-line bg-white/80">
            <div className="border-b border-blueprint-line bg-[#f5f3f3] p-4">
              <h2 className="text-ui-label text-primary">Interviewer Prompt</h2>
            </div>
            <div className="flex flex-1 flex-col gap-6 p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                    <span className="material-symbols-outlined text-[14px]">record_voice_over</span>
                  </div>
                  <span className="text-ui-label text-blueprint-muted">Interviewer</span>
                </div>
                <div className="rounded-lg border border-blueprint-line bg-[#f5f3f3] p-4 text-body-md text-primary">
                  {context.prompt}
                  <p className="mt-3 text-body-md text-blueprint-muted">
                    {context.followUp}
                  </p>
                </div>
              </div>
              <div className="mt-auto border-b border-blueprint-line pb-2">
                <label className="flex items-center gap-2 text-body-md text-blueprint-muted">
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                  <input className="w-full bg-transparent outline-none placeholder:text-blueprint-muted" placeholder="Say how you would debug or design this..." />
                </label>
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-xl border border-[#333333] bg-[#1e1e1e]">
            <div className="flex items-center gap-4 border-b border-[#333333] bg-[#252526] p-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ED6A5E]" />
                <div className="h-3 w-3 rounded-full bg-[#F4BF4F]" />
                <div className="h-3 w-3 rounded-full bg-[#61C554]" />
              </div>
              <span className="text-ui-label text-[#858585] normal-case">{context.fileName}</span>
            </div>
            <div className="min-h-[640px] p-4">
              <LiveCodingSession variant="dark" className="h-full border-0 bg-transparent p-0 shadow-none" />
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <article className="rounded-xl border border-blueprint-line bg-white/80 p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)]">
              <h2 className="mb-6 text-ui-label text-primary">What We Are Watching</h2>
              <div>
                <div className="mb-2 flex items-center justify-between text-body-md text-primary"><span>Clarity</span><span>82%</span></div>
                <div className="h-1 w-full rounded-full bg-blueprint-line"><div className="h-full w-[82%] rounded-full bg-primary" /></div>
              </div>
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-body-md text-primary"><span>Tradeoffs</span><span>A-</span></div>
                <div className="h-1 w-full rounded-full bg-blueprint-line"><div className="h-full w-[90%] rounded-full bg-primary" /></div>
              </div>
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-body-md text-primary"><span>Edge Cases</span><span>61%</span></div>
                <div className="h-1 w-full rounded-full bg-blueprint-line"><div className="h-full w-[61%] rounded-full bg-primary" /></div>
              </div>
            </article>

            <article className="flex flex-1 flex-col overflow-hidden rounded-xl border border-blueprint-line bg-white/80 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between border-b border-blueprint-line p-4">
                <h2 className="text-ui-label text-primary">Session Notes</h2>
                <span className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <div className="space-y-4 p-4 text-body-md text-blueprint-muted">
                {context.notes.map((item) => (
                  <div key={item} className="flex gap-3">
                    <span className="material-symbols-outlined text-[18px] text-primary">arrow_right_alt</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>

        <div className="flex justify-end">
          <button type="button" onClick={() => navigate('/pulse')} className="rounded-full border border-red-300 bg-white px-6 py-2.5 text-ui-label text-red-600 transition-colors hover:bg-red-50">
            End Round
          </button>
        </div>
      </main>
    </div>
  );
}