import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoundGuard from '../components/RoundGuard';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';
import { startRoundAttempt, submitRoundAttempt, type StoredRoundAttempt } from '../lib/questionBankApi';

const SCENARIOS: Record<string, { track: string; topic: string; title: string; body: string; filename: string; snippet: string }> = {
  frontend: {
    track: 'Frontend Machine Coding Session',
    topic: 'Async State',
    title: 'Prevent stale results in a live search screen',
    body: 'Pick the change that keeps the UI in sync when requests return out of order after the user types quickly.',
    filename: 'SearchResults.tsx',
    snippet: `function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetch('/api/search?q=' + query)
      .then((response) => response.json())
      .then((data) => setResults(data.items));
  }, [query]);

  return <ResultsList items={results} />;
}`,
  },
  backend: {
    track: 'Scenario-Based Backend Test',
    topic: 'Idempotency',
    title: 'Handle duplicate webhook deliveries safely',
    body: 'Choose the change that prevents duplicate state updates when the payment provider retries the same webhook.',
    filename: 'paymentWebhook.ts',
    snippet: `app.post('/webhooks/payment', async (req, res) => {
  const event = req.body;
  await markInvoicePaid(event.invoiceId);
  await sendReceipt(event.invoiceId);
  res.sendStatus(200);
});`,
  },
  'full-stack': {
    track: 'Full Stack Build Round',
    topic: 'State Sync',
    title: 'Keep optimistic UI and server state from drifting apart',
    body: 'Choose the change that avoids showing a successful save in the UI when the server write eventually fails.',
    filename: 'CheckoutFlow.ts',
    snippet: `async function saveCart(nextCart) {
  setCart(nextCart);
  setStatus('saved');
  await api.updateCart(nextCart);
}`,
  },
  'ai-ml': {
    track: 'Retrieval Scenario Test',
    topic: 'Retrieval Quality',
    title: 'Stop weak context from reaching the answer stage',
    body: 'Pick the change that improves answer quality when the retriever returns low-signal chunks.',
    filename: 'retrievalPipeline.py',
    snippet: `docs = retriever.search(query)
prompt = build_prompt(query, docs)
answer = llm.generate(prompt)
return answer`,
  },
};

export default function Registry() {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const [attempt, setAttempt] = useState<StoredRoundAttempt | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const scenario = SCENARIOS[workspace.selections.domain] ?? SCENARIOS.frontend;
  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const title = currentQuestion?.questionText ?? scenario.title;
  const options = currentQuestion?.options ?? ['Add request cancellation and ignore stale responses', 'Keep every response and sort later', 'Move all state into one global object', 'Remove loading states'];
  const submittedCurrent = Boolean(currentQuestion && answers[currentQuestion.id]);
  const isLastQuestion = currentIndex === questions.length - 1;

  const startAttempt = useCallback(async () => {
    if (attempt || loadingAttempt) return;
    setLoadingAttempt(true);
    setError(null);
    const result = await startRoundAttempt({
      roundType: 'scenario-round',
      questionType: 'scenario',
      domain: workspace.selections.domain,
      limit: 5,
      durationMinutes: 15,
    });
    setLoadingAttempt(false);
    if ('error' in result) {
      throw new Error(result.error);
    }
    setAttempt(result.data);
  }, [attempt, loadingAttempt, workspace.selections.domain]);

  const finalizeRound = useCallback(async (autoSubmitted = false) => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    const currentDraft = currentQuestion && !answers[currentQuestion.id] && draftAnswer
      ? { ...answers, [currentQuestion.id]: draftAnswer }
      : answers;
    const payload = questions.map((question) => ({ questionId: question.id, selectedAnswer: currentDraft[question.id] ?? null }));
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

  const handleSubmitCurrent = () => {
    if (!currentQuestion || !draftAnswer) return;
    setAnswers((current) => ({ ...current, [currentQuestion.id]: draftAnswer }));
  };

  const handleAdvance = () => {
    if (!submittedCurrent) return;
    if (isLastQuestion) {
      void finalizeRound(false);
      return;
    }
    setCurrentIndex((value) => value + 1);
    setDraftAnswer(answers[questions[currentIndex + 1]?.id] ?? '');
  };

  const handlePrevious = () => {
    if (currentIndex === 0) {
      navigate('/practice-tracks');
      return;
    }
    setCurrentIndex((value) => value - 1);
    setDraftAnswer(answers[questions[currentIndex - 1]?.id] ?? '');
  };

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-8 lg:px-16">
      <RoundGuard roundName="Scenario Round" durationMinutes={15} resultsPath="/results/scenario-round" onStart={startAttempt} onExpire={() => finalizeRound(true)}>
        {({ formattedTime, inputsLocked }) => (
          <>
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto flex w-full max-w-256 flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-blueprint-line pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-ui-label text-primary">
            <button type="button" onClick={() => navigate('/practice-tracks')} className="transition-colors hover:text-blueprint-muted">
              Exit Round
            </button>
            <div className="h-4 w-px bg-blueprint-line" />
            <span className="text-blueprint-muted">{DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend'} Practice</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 rounded-full border border-blueprint-line bg-white px-3 py-1.5 text-ui-label text-primary">
              <span className="material-symbols-outlined text-[16px] text-[#5d5f5d]">timer</span>
              {formattedTime}
            </div>
            <div className="flex gap-1">
              {questions.map((question, index) => (
                <div key={question.id} className={`h-1 w-8 rounded-full ${index <= currentIndex ? 'bg-primary' : 'bg-blueprint-line'}`} />
              ))}
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <article className="space-y-6 lg:col-span-7">
            {loadingAttempt ? <p className="text-body-md text-blueprint-muted">Loading scenario set…</p> : null}
            {error ? <p className="text-body-md text-red-600">{error}</p> : null}
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#e4e2e2] px-3 py-1.5 text-ui-label text-blueprint-muted">Question {currentIndex + 1} of {questions.length}</span>
              <span className="rounded-full border border-blueprint-line bg-[#efeded] px-3 py-1.5 text-ui-label text-blueprint-muted">{currentQuestion?.topic ?? scenario.topic}</span>
            </div>
            <div className="max-w-2xl space-y-4">
              <p className="text-ui-label text-blueprint-muted">{scenario.track}</p>
              <h1 className="text-headline-lg text-primary">{title}</h1>
              <p className="text-body-lg text-blueprint-muted">
                {scenario.body}
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-blueprint-line bg-white/85 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 border-b border-blueprint-line bg-white px-4 py-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-blueprint-line" />
                  <div className="h-2.5 w-2.5 rounded-full bg-blueprint-line" />
                  <div className="h-2.5 w-2.5 rounded-full bg-blueprint-line" />
                </div>
                <span className="ml-4 text-ui-label text-blueprint-muted normal-case">{scenario.filename}</span>
              </div>
              <pre className="overflow-x-auto p-6 text-[13px] leading-7 text-blueprint-muted"><code>{currentQuestion?.codeSnippet ?? scenario.snippet}</code></pre>
            </div>
          </article>

          <article className="surface-card lg:col-span-5">
            <p className="text-ui-label text-blueprint-muted">Choose the best answer</p>
            <div className="mt-5 space-y-3">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={inputsLocked || submittedCurrent}
                  onClick={() => setDraftAnswer(option)}
                  className={`w-full rounded-xl border p-4 text-left text-body-md transition-colors ${draftAnswer === option ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-[#fbf9f9] text-primary hover:bg-white'} ${inputsLocked || submittedCurrent ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="surface-inset mt-5 text-body-md text-blueprint-muted">
              {submittedCurrent
                ? 'Answer locked for this question. Review it, then move to the next one.'
                : 'Select one option, then submit it before moving on.'}
            </div>
            <details className="surface-inset mt-5">
              <summary className="cursor-pointer text-ui-label text-primary">Why this question matters</summary>
              <p className="mt-3 text-body-md text-blueprint-muted">{currentQuestion?.explanation ?? 'Scenario questions test judgment under production constraints.'}</p>
            </details>
          </article>
        </section>

        <footer className="flex flex-col gap-4 border-t border-blueprint-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={handlePrevious} className="rounded-full border border-blueprint-line px-6 py-2.5 text-ui-label text-primary transition-colors hover:bg-white">
            {currentIndex === 0 ? 'Exit Round' : 'Previous Question'}
          </button>
          {submittedCurrent ? (
            <button type="button" onClick={handleAdvance} className="rounded-full bg-primary px-8 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031]">
              {isLastQuestion ? 'Finish Round' : 'Next Question'}
            </button>
          ) : (
            <button type="button" disabled={!draftAnswer || inputsLocked} onClick={handleSubmitCurrent} className="rounded-full bg-primary px-8 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Answer'}
            </button>
          )}
        </footer>
      </main>
          </>
        )}
      </RoundGuard>
    </div>
  );
}
