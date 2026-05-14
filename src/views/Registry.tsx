import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoundGuard from '../components/RoundGuard';
import RoundShell from '../components/RoundShell';
import { DOMAIN_LABELS } from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';
import {
  requestRoundFeedback,
  startRoundAttempt,
  submitRoundAttempt,
  type RoundFeedback,
  type StoredRoundAttempt,
} from '../lib/questionBankApi';
import { saveLocalDraft, saveServerDraft } from '../lib/roundRuntime';

export default function Registry() {
  const navigate = useNavigate();
  const workspace = usePrepWorkspace();
  const [attempt, setAttempt] = useState<StoredRoundAttempt | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, RoundFeedback>>({});
  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const submittedCurrent = Boolean(currentQuestion && answers[currentQuestion.id]);
  const isLastQuestion = currentIndex === questions.length - 1;
  const domainLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Selected Domain';
  const answerLength = draftAnswer.trim().length;
  const answerLengthTone = answerLength === 0 ? 'neutral' : answerLength < 40 ? 'red' : answerLength < 80 ? 'amber' : 'neutral';

  const startAttempt = useCallback(async () => {
    if (attempt || loadingAttempt) return;
    setLoadingAttempt(true);
    setError(null);
    const result = await startRoundAttempt({
      roundType: 'scenario-round',
      questionType: 'scenario',
      domain: workspace.selections.domain,
      limit: 5,
      durationMinutes: 30,
    });
    setLoadingAttempt(false);
    if ('error' in result) throw new Error(result.error);
    setAttempt(result.data);
  }, [attempt, loadingAttempt, workspace.selections.domain]);

  const submitStep = async () => {
    if (!attempt || !currentQuestion || !draftAnswer.trim() || feedbackLoading) return;
    setFeedbackLoading(true);
    setError(null);
    const result = await requestRoundFeedback(attempt.id, {
      questionId: currentQuestion.id,
      answer: draftAnswer,
      mode: 'scenario',
    });
    setFeedbackLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAnswers((current) => ({ ...current, [currentQuestion.id]: draftAnswer }));
    setFeedback((current) => ({ ...current, [currentQuestion.id]: result.data }));
    saveLocalDraft('scenario-round', attempt.id, { currentIndex, answers: { ...answers, [currentQuestion.id]: draftAnswer }, feedback: { ...feedback, [currentQuestion.id]: result.data } });
    void saveServerDraft('scenario-round', attempt.id, { currentIndex, answers: { ...answers, [currentQuestion.id]: draftAnswer }, feedback: { ...feedback, [currentQuestion.id]: result.data } });
  };

  const finalizeRound = useCallback(async (autoSubmitted = false) => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    const currentDraft = currentQuestion && !answers[currentQuestion.id] && draftAnswer
      ? { ...answers, [currentQuestion.id]: draftAnswer }
      : answers;
    const payload = questions.map((question) => ({
      questionId: question.id,
      selectedAnswer: currentDraft[question.id] ?? null,
      notes: currentDraft[question.id] ?? null,
    }));
    const result = await submitRoundAttempt(attempt.id, {
      answers: payload,
      autoSubmitted,
      timeSpentSeconds: attempt.durationMinutes * 60,
    });
    setSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAttempt(result.data);
    if (!autoSubmitted) navigate('/results/scenario-round');
  }, [answers, attempt, currentQuestion, draftAnswer, navigate, questions, submitting]);

  const advance = () => {
    if (!submittedCurrent) return;
    if (isLastQuestion) {
      void finalizeRound(false);
      return;
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setDraftAnswer(answers[questions[nextIndex]?.id] ?? '');
  };

  const previous = () => {
    if (currentIndex === 0) {
      navigate('/practice-tracks');
      return;
    }
    const nextIndex = currentIndex - 1;
    setCurrentIndex(nextIndex);
    setDraftAnswer(answers[questions[nextIndex]?.id] ?? '');
  };

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-8 lg:px-16">
      <RoundGuard roundName="Scenario Round" durationMinutes={30} resultsPath="/results/scenario-round" onStart={startAttempt} onExpire={() => finalizeRound(true)}>
        {({ formattedTime, inputsLocked }) => (
          <>
            <RoundShell attemptId={attempt?.id} feature="scenario-round" label={`${domainLabel} Scenario Round`} startedAt={attempt?.startedAt} counter={`Step ${Math.min(currentIndex + 1, questions.length || 1)} of ${questions.length || 5}`} onEndEarly={() => { void finalizeRound(false); }}>
            <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
            <main className="relative z-10 mx-auto flex w-full max-w-320 flex-col gap-6">
              <header className="flex flex-col gap-4 border-b border-blueprint-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-ui-label text-blueprint-muted">{domainLabel} Scenario Round</p>
                  <h1 className="mt-2 text-display-xl text-primary">Work through the case one step at a time.</h1>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rounded-full border border-blueprint-line bg-card px-3 py-1.5 text-ui-label text-primary">{formattedTime}</span>
                  <span className="text-ui-label text-blueprint-muted">{Math.min(currentIndex + 1, questions.length || 1)} / {questions.length || 5}</span>
                </div>
              </header>

              {loadingAttempt ? <p className="text-body-md text-blueprint-muted">Loading scenario...</p> : null}
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <article className="surface-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">{currentQuestion?.topic ?? 'Scenario'}</span>
                    <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">Step {currentIndex + 1}</span>
                  </div>
                  <h2 className="mt-4 text-headline-lg text-primary">{currentQuestion?.questionText ?? 'Start the round to load a workplace scenario.'}</h2>
                  {currentQuestion?.codeSnippet ? (
                    <pre className="mt-5 overflow-x-auto rounded-xl bg-[#1A1A1A] p-5 text-[13px] leading-6 text-[#d4d4d4]"><code>{currentQuestion.codeSnippet}</code></pre>
                  ) : null}
                  <textarea
                    value={draftAnswer}
                    onChange={(event) => setDraftAnswer(event.target.value)}
                    disabled={inputsLocked || !currentQuestion || submittedCurrent}
                    className="mt-5 min-h-[220px] w-full resize-none rounded-xl border border-blueprint-line bg-[#fbf9f9] p-4 text-body-md text-primary outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Describe your diagnosis, decision, tradeoff, and verification step."
                  />
                  <div className={`mt-2 text-ui-label ${answerLengthTone === 'red' ? 'text-red-600' : answerLengthTone === 'amber' ? 'text-[#9a6a00]' : 'text-blueprint-muted'}`}>
                    {answerLength} characters
                    {answerLengthTone === 'red' ? ' - Too short to evaluate well; expand your reasoning.' : ''}
                    {answerLengthTone === 'amber' ? ' - Getting close; aim for at least 80 characters.' : ''}
                  </div>
                  {submittedCurrent && feedback[currentQuestion.id] ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {feedback[currentQuestion.id].aiUnavailable ? <p className="rounded-lg border border-blueprint-line bg-[#fff7df] px-4 py-3 text-body-md text-primary sm:col-span-2">AI evaluation temporarily unavailable - your answer is saved and will be re-evaluated shortly.</p> : null}
                      <div className="surface-inset">
                        <p className="text-ui-label text-blueprint-muted">Feedback</p>
                        <p className="mt-2 text-body-md text-primary">{feedback[currentQuestion.id].feedback}</p>
                      </div>
                      <div className="surface-inset">
                        <p className="text-ui-label text-blueprint-muted">Senior Engineer Would Say</p>
                        <p className="mt-2 text-body-md text-primary">{feedback[currentQuestion.id].seniorEngineerWouldHaveSaid}</p>
                      </div>
                    </div>
                  ) : null}
                </article>

                <aside className="surface-card h-fit">
                  <p className="text-ui-label text-blueprint-muted">Step Feedback</p>
                  <div className="mt-4 space-y-3">
                    {questions.map((question, index) => (
                      <button
                        key={question.id}
                        type="button"
                        disabled={index > currentIndex}
                        onClick={() => {
                          setCurrentIndex(index);
                          setDraftAnswer(answers[question.id] ?? '');
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-body-md ${
                          index === currentIndex ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-card text-primary'
                        } ${index > currentIndex ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <span>Step {index + 1}</span>
                        <span>{feedback[question.id]?.score ? `${feedback[question.id].score}/10` : answers[question.id] ? 'done' : 'open'}</span>
                      </button>
                    ))}
                  </div>
                </aside>
              </section>

              <footer className="flex flex-col gap-4 border-t border-blueprint-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={previous} className="rounded-full border border-blueprint-line px-6 py-2.5 text-ui-label text-primary hover:bg-[#f5f3f3]">
                  {currentIndex === 0 ? 'Exit Round' : 'Previous Step'}
                </button>
                {submittedCurrent ? (
                  <button type="button" onClick={advance} className="rounded-full bg-primary px-8 py-2.5 text-ui-label text-white hover:bg-[#303031]">
                    {isLastQuestion ? (submitting ? 'Finishing...' : 'Finish Round') : 'Next Step'}
                  </button>
                ) : (
                  <button type="button" disabled={!draftAnswer.trim() || inputsLocked || feedbackLoading} onClick={() => { void submitStep(); }} className="rounded-full bg-primary px-8 py-2.5 text-ui-label text-white hover:bg-[#303031] disabled:cursor-not-allowed disabled:opacity-50">
                    {feedbackLoading ? 'Getting Feedback...' : 'Submit Step'}
                  </button>
                )}
              </footer>
      </main>
            </RoundShell>
          </>
        )}
      </RoundGuard>
    </div>
  );
}
