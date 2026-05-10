import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoundGuard from '../components/RoundGuard';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';
import { startRoundAttempt, submitRoundAttempt, type StoredRoundAttempt } from '../lib/questionBankApi';
import { View } from '../App';

interface TerminalPageProps {
  onViewChange: (view: View) => void;
}

export default function TerminalPage(_props: TerminalPageProps) {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const [attempt, setAttempt] = useState<StoredRoundAttempt | null>(null);
  const [answer, setAnswer] = useState('');
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const question = attempt?.questions[0] ?? null;
  const domainLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend';

  const startAttempt = useCallback(async () => {
    if (attempt || loadingAttempt) return;
    setLoadingAttempt(true);
    setError(null);
    const result = await startRoundAttempt({
      roundType: 'mock-interview',
      questionType: 'mock',
      domain: workspace.selections.domain,
      limit: 1,
      durationMinutes: 25,
    });
    setLoadingAttempt(false);
    if ('error' in result) throw new Error(result.error);
    setAttempt(result.data);
  }, [attempt, loadingAttempt, workspace.selections.domain]);

  const finishRound = useCallback(async (autoSubmitted = false) => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    const result = await submitRoundAttempt(attempt.id, {
      answers: [{ questionId: question?.id ?? '', selectedAnswer: answer, notes: answer }],
      autoSubmitted,
      timeSpentSeconds: attempt.durationMinutes * 60,
    });
    setSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAttempt(result.data);
    if (!autoSubmitted) navigate('/results/mock-interview');
  }, [answer, attempt, navigate, question?.id, submitting]);

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-8 lg:px-12">
      <RoundGuard roundName="Mock Interview Round" durationMinutes={25} resultsPath="/results/mock-interview" onStart={startAttempt} onExpire={() => finishRound(true)}>
        {({ formattedTime, inputsLocked }) => (
          <>
            <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
            <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5">
              <header className="surface-card-compact flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-ui-label text-blueprint-muted">{domainLabel} Mock Interview</p>
                  <h1 className="text-headline-md text-primary not-italic">Answer out loud, then write the structured version.</h1>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-blueprint-line bg-[#efeded] px-3 py-1.5 text-ui-label text-primary">
                  <span className="material-symbols-outlined text-[16px]">timer</span>
                  {formattedTime}
                </div>
              </header>

              {loadingAttempt ? <p className="text-body-md text-blueprint-muted">Loading mock interview prompt...</p> : null}
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}

              <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <article className="surface-card">
                  <p className="text-ui-label text-blueprint-muted">Interviewer Prompt</p>
                  <h2 className="mt-3 text-headline-md text-primary not-italic">{question?.topic ?? 'Project decision walkthrough'}</h2>
                  <p className="mt-4 text-body-lg text-primary">
                    {question?.questionText ?? 'Start the round to load a domain-specific mock interview prompt.'}
                  </p>
                  <div className="surface-inset mt-5">
                    <p className="text-ui-label text-blueprint-muted">Strong answer pattern</p>
                    <p className="mt-2 text-body-md text-primary">{question?.correctAnswer ?? 'Problem, decision, tradeoff, result, and validation.'}</p>
                  </div>
                </article>

                <article className="surface-card flex flex-col">
                  <label className="text-ui-label text-blueprint-muted">Your Response</label>
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    disabled={inputsLocked || !question}
                    className="mt-3 min-h-[320px] flex-1 resize-none rounded-xl border border-blueprint-line bg-[#fbf9f9] p-4 text-body-md text-primary outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Write what you said. Include the tradeoff, failure mode, and how you would verify it."
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => navigate('/practice-tracks')} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
                      Exit
                    </button>
                    <button type="button" disabled={inputsLocked || submitting || !question} onClick={() => setConfirmOpen(true)} className="rounded-full bg-primary px-6 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:cursor-not-allowed disabled:opacity-60">
                      {submitting ? 'Submitting...' : 'End Round'}
                    </button>
                  </div>
                </article>
              </section>
            </main>

            {confirmOpen ? (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-blueprint-line bg-white p-6 shadow-2xl">
                  <p className="text-ui-label text-blueprint-muted">End Round</p>
                  <h2 className="mt-2 text-headline-md text-primary not-italic">Submit this mock interview?</h2>
                  <p className="mt-2 text-body-md text-blueprint-muted">
                    Your answer will be locked and evaluated from the saved response.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">Keep Working</button>
                    <button type="button" onClick={() => { setConfirmOpen(false); void finishRound(false); }} className="rounded-full bg-primary px-5 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031]">Submit Round</button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </RoundGuard>
    </div>
  );
}
