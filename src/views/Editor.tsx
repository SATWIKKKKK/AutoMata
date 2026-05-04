import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CodingPlayground } from '../components/ModulePlaceholders';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';

type WorkflowDAG = unknown;

interface EditorProps {
  workflow: WorkflowDAG | null;
  onSave: (dag: WorkflowDAG) => void;
}

const CHALLENGES: Record<string, { tag: string; duration: string; title: string; summary: string; constraints: string[]; exampleInput: string; expectedOutput: string; fileName: string; language: string }> = {
  frontend: {
    tag: 'Frontend',
    duration: '45 Min',
    title: 'Stabilize live search results',
    summary: 'Build a search flow that stays correct when requests resolve out of order and the user keeps typing.',
    constraints: [
      'Keep the latest query result on screen even if older requests finish later.',
      'Show loading and error states without breaking the current results.',
      'Explain how you would test the race condition.',
    ],
    exampleInput: 'query changes quickly from "r" to "react" while earlier requests are still in flight',
    expectedOutput: 'Only the latest query updates the results and stale responses are ignored safely.',
    fileName: 'SearchResults.tsx',
    language: 'TypeScript',
  },
  backend: {
    tag: 'Backend',
    duration: '45 Min',
    title: 'Make webhook processing idempotent',
    summary: 'Handle duplicate webhook deliveries without double-updating the database or sending duplicate side effects.',
    constraints: [
      'Prevent duplicate writes when the provider retries the same event.',
      'Return a safe response even when the worker is slow.',
      'Explain how you would store replay protection.',
    ],
    exampleInput: 'the same payment event is delivered three times within 20 seconds',
    expectedOutput: 'The invoice is updated once, side effects are emitted once, and retries remain safe.',
    fileName: 'paymentWebhook.ts',
    language: 'TypeScript',
  },
  'full-stack': {
    tag: 'Full Stack',
    duration: '50 Min',
    title: 'Keep optimistic UI and server state aligned',
    summary: 'Wire a client mutation to the server while handling partial failure without leaving the UI in a fake success state.',
    constraints: [
      'Show the user what is pending and what failed.',
      'Avoid duplicate submissions when they click twice.',
      'Explain how the client recovers after a failed write.',
    ],
    exampleInput: 'a save button is clicked twice while the first write is still pending',
    expectedOutput: 'The UI stays responsive, only one write is accepted, and recovery is clear after failure.',
    fileName: 'CheckoutFlow.ts',
    language: 'TypeScript',
  },
  'ai-ml': {
    tag: 'AI / ML',
    duration: '45 Min',
    title: 'Filter weak retrieval before answer generation',
    summary: 'Improve a retrieval pipeline so low-signal chunks do not poison the final answer under time pressure.',
    constraints: [
      'Reject or down-rank poor matches before they reach the prompt.',
      'Add one fallback when retrieval confidence is low.',
      'Explain how you would evaluate the change.',
    ],
    exampleInput: 'the retriever returns loosely related chunks with low semantic overlap',
    expectedOutput: 'The pipeline uses stronger context selection and degrades gracefully when confidence is low.',
    fileName: 'retrievalPipeline.py',
    language: 'Python',
  },
};

export default function Editor(_props: EditorProps) {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const challenge = CHALLENGES[workspace.selections.domain] ?? CHALLENGES.frontend;

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360">
        <div className="grid gap-8 lg:grid-cols-12">
          <section className="space-y-8 lg:col-span-5 lg:border-r lg:border-blueprint-line/40 lg:pr-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#e4e2e2] px-3 py-1 text-ui-label text-blueprint-muted">{challenge.tag}</span>
                <span className="flex items-center gap-1 text-ui-label text-blueprint-muted">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  {challenge.duration}
                </span>
              </div>
              <p className="text-ui-label text-blueprint-muted">{DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend'} Coding Round</p>
              <h1 className="text-headline-lg text-primary">{challenge.title}</h1>
              <p className="text-body-lg text-blueprint-muted">
                {challenge.summary}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="border-b border-blueprint-line/50 pb-2 text-ui-label text-primary">What matters in this answer</h2>
                <ul className="space-y-2 pt-3 text-body-md text-blueprint-muted">
                  {challenge.constraints.map((item) => (
                    <li key={item} className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px]">check_circle</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="border-b border-blueprint-line/50 pb-2 text-ui-label text-primary">Example Input</h2>
                <div className="mt-3 rounded-lg border border-blueprint-line/30 bg-[#efeded] p-4 text-body-md text-primary">
                  {challenge.exampleInput}
                </div>
              </div>
              <div>
                <h2 className="border-b border-blueprint-line/50 pb-2 text-ui-label text-primary">Expected Output</h2>
                <div className="mt-3 rounded-lg border border-blueprint-line/30 bg-[#efeded] p-4 text-body-md text-primary">
                  {challenge.expectedOutput}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#333333] bg-[#1A1A1A] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] lg:col-span-7">
            <div className="flex h-12 items-center justify-between border-b border-[#333333] bg-[#141414] px-4">
              <div className="flex items-center gap-4 text-[#888888]">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#333333]" />
                  <div className="h-3 w-3 rounded-full bg-[#333333]" />
                  <div className="h-3 w-3 rounded-full bg-[#333333]" />
                </div>
                <span className="text-ui-label normal-case">{challenge.fileName}</span>
              </div>
              <div className="flex items-center gap-3 text-[#888888]">
                <span className="text-ui-label normal-case">{challenge.language}</span>
                <span className="material-symbols-outlined text-[18px]">settings</span>
                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              </div>
            </div>
            <div className="min-h-[440px] border-b border-[#333333] bg-[#1A1A1A] p-4">
              <CodingPlayground variant="dark" className="h-full border-0 bg-transparent p-0 shadow-none" />
            </div>
            <div className="flex h-16 items-center justify-between bg-[#141414] px-4">
              <div className="flex items-center gap-4 text-[#888888] text-ui-label normal-case">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">play_circle</span>Output</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">fact_check</span>Checks</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-full border border-[#555555] px-4 py-2 text-ui-label text-[#d4d4d4] transition-colors hover:bg-[#333333]">
                  Run Checks
                </button>
                <button type="button" onClick={() => navigate('/terminal')} className="rounded-full bg-white px-6 py-2 text-ui-label text-black transition-colors hover:bg-[#efeded]">
                  Continue to Mock Round
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}