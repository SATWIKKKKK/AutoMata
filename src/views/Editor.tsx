import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoundGuard from '../components/RoundGuard';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';
import { startRoundAttempt, submitRoundAttempt, type StoredRoundAttempt } from '../lib/questionBankApi';

type WorkflowDAG = unknown;

interface EditorProps {
  workflow: WorkflowDAG | null;
  onSave: (dag: WorkflowDAG) => void;
}

export default function Editor(_props: EditorProps) {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const [attempt, setAttempt] = useState<StoredRoundAttempt | null>(null);
  const [codeAnswer, setCodeAnswer] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftChecks, setDraftChecks] = useState<string[]>([]);
  const question = attempt?.questions[0] ?? null;
  const questionLabel = useMemo(() => DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend', [workspace.selections.domain]);

  const startAttempt = useCallback(async () => {
    if (attempt || loadingAttempt) return;
    setLoadingAttempt(true);
    setError(null);
    const result = await startRoundAttempt({
      roundType: 'coding-round',
      questionType: 'coding',
      domain: workspace.selections.domain,
      limit: 1,
      durationMinutes: 45,
    });
    setLoadingAttempt(false);
    if ('error' in result) {
      throw new Error(result.error);
    }
    setAttempt(result.data);
    setCodeAnswer(result.data.questions[0]?.codeSnippet ?? '');
  }, [attempt, loadingAttempt, workspace.selections.domain]);

  const runDraftChecks = () => {
    const nextChecks = [
      codeAnswer.trim().length >= 80 ? 'Substantial solution draft captured.' : 'Expand the draft so the main logic is visible.',
      /\breturn\b|\byield\b/.test(codeAnswer) ? 'Return path found.' : 'Add an explicit return path.',
      /\bif\b|\belse\b|\btry\b|\bcatch\b/.test(codeAnswer) ? 'Conditional or recovery handling found.' : 'Show one clear edge-case or recovery branch.',
      /error|throw|validate|guard|abort|rollback|idempot|dedup|cache|cleanup/i.test(codeAnswer + notes) ? 'Defensive handling or production note found.' : 'Explain one defensive or production-oriented check.',
    ];
    setDraftChecks(nextChecks);
  };

  const finishRound = useCallback(async (autoSubmitted = false) => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    const result = await submitRoundAttempt(attempt.id, {
      answers: [{ questionId: question?.id ?? '', codeAnswer, notes }],
      autoSubmitted,
      timeSpentSeconds: attempt.durationMinutes * 60,
    });
    setSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAttempt(result.data);
    if (!autoSubmitted) navigate('/results/coding-round');
  }, [attempt, codeAnswer, notes, navigate, question?.id, submitting]);

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-12">
      <RoundGuard roundName="Coding Round" durationMinutes={45} resultsPath="/results/coding-round" onStart={startAttempt} onExpire={() => finishRound(true)}>
        {({ formattedTime, inputsLocked }) => (
          <>
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360">
        <div className="grid gap-8 lg:grid-cols-12">
          <section className="space-y-8 lg:col-span-5 lg:border-r lg:border-blueprint-line/40 lg:pr-8">
            {loadingAttempt ? <p className="text-body-md text-blueprint-muted">Loading coding prompt…</p> : null}
            {error ? <p className="text-body-md text-red-600">{error}</p> : null}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#e4e2e2] px-3 py-1 text-ui-label text-blueprint-muted">{questionLabel}</span>
                <span className="flex items-center gap-1 text-ui-label text-blueprint-muted">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  {formattedTime} left
                </span>
              </div>
              <p className="text-ui-label text-blueprint-muted">{questionLabel} Coding Round</p>
              <h1 className="text-headline-lg text-primary">{question?.topic ?? 'Coding prompt'}</h1>
              <p className="text-body-lg text-blueprint-muted">
                {question?.questionText ?? 'Start the round to load a coding question.'}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="border-b border-blueprint-line/50 pb-2 text-ui-label text-primary">What matters in this answer</h2>
                <p className="pt-3 text-body-md text-blueprint-muted">{question?.explanation ?? 'Your result will store the exact draft, basic evaluation signals, and the next study step for this attempt.'}</p>
              </div>
              <div>
                <h2 className="border-b border-blueprint-line/50 pb-2 text-ui-label text-primary">Starter Prompt</h2>
                <div className="mt-3 rounded-lg border border-blueprint-line/30 bg-[#efeded] p-4 text-body-md text-primary">
                  {question?.questionText ?? 'Question details load once the timed round starts.'}
                </div>
              </div>
              <div>
                <h2 className="border-b border-blueprint-line/50 pb-2 text-ui-label text-primary">Stored Answer Key</h2>
                <div className="mt-3 rounded-lg border border-blueprint-line/30 bg-[#efeded] p-4 text-body-md text-primary">
                  {question?.correctAnswer ?? 'The expected answer pattern for this question will appear in your results.'}
                </div>
              </div>
              {draftChecks.length ? (
                <div>
                  <h2 className="border-b border-blueprint-line/50 pb-2 text-ui-label text-primary">Draft Checks</h2>
                  <ul className="space-y-2 pt-3 text-body-md text-blueprint-muted">
                    {draftChecks.map((item) => (
                      <li key={item} className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px]">check_circle</span>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
                <span className="text-ui-label normal-case">{question?.topic ?? 'solution.ts'}</span>
              </div>
              <div className="flex items-center gap-3 text-[#888888]">
                <span className="text-ui-label normal-case">Code Draft</span>
                <span className="material-symbols-outlined text-[18px]">settings</span>
                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              </div>
            </div>
            <div className="min-h-[440px] border-b border-[#333333] bg-[#1A1A1A] p-4">
              <textarea
                value={codeAnswer}
                onChange={(event) => setCodeAnswer(event.target.value)}
                disabled={inputsLocked || !question}
                spellCheck={false}
                className="h-[360px] w-full resize-none rounded-lg border border-[#333333] bg-[#111111] p-4 font-mono text-[13px] leading-6 text-[#d4d4d4] outline-none disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Your coding answer appears here once the round starts."
              />
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={inputsLocked || !question}
                className="mt-4 h-24 w-full resize-none rounded-lg border border-[#333333] bg-[#111111] p-4 text-body-md text-[#d4d4d4] outline-none disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Optional notes: explain tradeoffs, edge cases, or how you would validate the solution."
              />
            </div>
            <div className="flex h-16 items-center justify-between bg-[#141414] px-4">
              <div className="flex items-center gap-4 text-[#888888] text-ui-label normal-case">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">play_circle</span>Output</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">fact_check</span>Checks</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={runDraftChecks} disabled={inputsLocked || !question} className="rounded-full border border-[#555555] px-4 py-2 text-ui-label text-[#d4d4d4] transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-60">
                  Validate Draft
                </button>
                <button type="button" onClick={() => navigate('/practice-tracks')} className="rounded-full border border-[#555555] px-4 py-2 text-ui-label text-[#d4d4d4] transition-colors hover:bg-[#333333]">
                  Exit Round
                </button>
                <button type="button" disabled={inputsLocked || submitting || !question} onClick={() => { void finishRound(false); }} className="rounded-full bg-white px-6 py-2 text-ui-label text-black transition-colors hover:bg-[#efeded] disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit Coding Round'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
          </>
        )}
      </RoundGuard>
    </div>
  );
}
