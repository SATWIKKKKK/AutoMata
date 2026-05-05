import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';
import { fetchLatestRoundAttempt, type RoundAttemptDetail, type StoredRoundAttempt } from '../lib/questionBankApi';
import { getRoundResult } from '../lib/roundResults';

const ROUND_LABELS: Record<string, string> = {
  'scenario-round': 'Scenario Round Results',
  'coding-round': 'Coding Round Results',
  'mock-interview': 'Mock Interview Results',
  'practice-tracks': 'Practice Track Results',
  'full-test': 'Full Test Results',
};

export default function ResultsPage() {
  const navigate = useNavigate();
  const params = useParams<{ roundType?: string }>();
  const workspace = getStoredPrepWorkspace();
  const roundType = params.roundType ?? 'practice-tracks';
  const [attempt, setAttempt] = useState<StoredRoundAttempt | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(true);
  const storedResult = getRoundResult(roundType);
  const title = storedResult?.roundName ? `${storedResult.roundName} Results` : (ROUND_LABELS[roundType] ?? 'Results');
  const domainLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend';
  const weakPoints = workspace.repoAnalysis?.weakPoints ?? workspace.manualAnalysis?.gapsThatMightExist ?? [
    'Answer structure under time pressure',
    'Failure-mode explanation',
    'Project tradeoff depth',
  ];
  const fallbackDetails = useMemo(() => (
    storedResult?.details.map((detail) => ({
      questionId: detail.questionId,
      topic: detail.topic,
      prompt: detail.prompt,
      submittedAnswer: detail.selectedAnswer ?? null,
      correctAnswer: detail.correctAnswer,
      explanation: detail.explanation,
      isCorrect: detail.isCorrect,
      score: detail.isCorrect ? 100 : 0,
      observations: [],
    })) ?? []
  ), [storedResult]);
  const focusAreas = attempt?.focusAreas.length ? attempt.focusAreas : (storedResult?.focusAreas.length ? storedResult.focusAreas : weakPoints.slice(0, 4));
  const nextSteps = attempt?.nextSteps.length ? attempt.nextSteps : (storedResult?.nextSteps.length ? storedResult.nextSteps : [
    'Open the question bank and drill one weak topic before the next timed attempt.',
    'Repeat the same round only after you can explain the failure mode clearly.',
    'Carry one concrete fix into the next session instead of restarting from scratch.',
  ]);
  const readinessScore = attempt?.score ?? storedResult?.score ?? 78;
  const answeredQuestions = attempt?.answers.filter((answer) => Boolean(answer.selectedAnswer ?? answer.codeAnswer)).length ?? storedResult?.answeredQuestions ?? 0;
  const totalQuestions = attempt?.totalQuestions ?? storedResult?.totalQuestions ?? 0;
  const correctAnswers = attempt?.correctAnswers ?? storedResult?.correctAnswers ?? 0;
  const reviewDetails: RoundAttemptDetail[] = attempt?.results.length ? attempt.results : fallbackDetails;

  useEffect(() => {
    let ignore = false;
    setLoadingAttempt(true);
    void fetchLatestRoundAttempt(roundType).then((result) => {
      if (ignore) return;
      if (result.ok) setAttempt(result.data);
      setLoadingAttempt(false);
    });
    return () => {
      ignore = true;
    };
  }, [roundType]);

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360 space-y-8">
        <header className="flex flex-col gap-4 border-b border-blueprint-line pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-ui-label text-blueprint-muted">{domainLabel} analysis</p>
            <h1 className="mt-2 text-display-xl text-primary">{title}</h1>
            <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
              {attempt?.summary || 'Here is the latest round-level breakdown. If no persisted attempt exists yet, the page falls back to the local round summary.'}
            </p>
          </div>
          <button type="button" onClick={() => navigate('/practice-tracks')} className="rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
            Start Next Session
          </button>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <article className="surface-card lg:col-span-4">
            <div className="flex items-start justify-between gap-4">
              <span className="text-ui-label text-blueprint-muted">Readiness Score</span>
              <span className="rounded-full border border-blueprint-line bg-[#f5f3f3] px-4 py-2 text-ui-label text-primary">Updated Today</span>
            </div>
            {loadingAttempt ? <p className="mt-4 text-body-md text-blueprint-muted">Loading latest attempt…</p> : null}
            <p className="mt-8 font-serif text-[clamp(4rem,10vw,104px)] leading-none text-primary">{readinessScore}<span className="text-headline-md text-blueprint-muted">%</span></p>
            <p className="mt-5 text-body-md text-blueprint-muted">Answered {answeredQuestions} of {totalQuestions} prompts with {correctAnswers} correct or accepted responses in this round.</p>
          </article>

          <article className="surface-card lg:col-span-8">
            <h2 className="text-headline-md text-primary not-italic">Section Breakdown</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ['Round score', `${readinessScore}%`, `w-[${readinessScore}%]`],
                ['Completion', `${Math.round((answeredQuestions / Math.max(totalQuestions, 1)) * 100)}%`, `w-[${Math.round((answeredQuestions / Math.max(totalQuestions, 1)) * 100)}%]`],
                ['Accuracy', `${Math.round((correctAnswers / Math.max(totalQuestions, 1)) * 100)}%`, `w-[${Math.round((correctAnswers / Math.max(totalQuestions, 1)) * 100)}%]`],
                ['Retention target', `${Math.max(60, Math.min(95, readinessScore + 8))}%`, `w-[${Math.max(60, Math.min(95, readinessScore + 8))}%]`],
              ].map(([label, value, width]) => (
                <div key={label} className="surface-inset">
                  <div className="mb-3 flex items-center justify-between text-body-md text-primary"><span>{label}</span><span>{value}</span></div>
                  <div className="h-2 rounded-full bg-blueprint-line"><div className={`h-full rounded-full bg-primary ${width}`} /></div>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-card lg:col-span-6">
            <h2 className="text-headline-md text-primary not-italic">Focus Areas</h2>
            <div className="mt-6 space-y-3">
              {focusAreas.slice(0, 4).map((point, index) => (
                <div key={point} className="surface-inset">
                  <p className="text-ui-label text-blueprint-muted">Priority {index + 1}</p>
                  <p className="mt-1 text-body-md text-primary">{point}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-card lg:col-span-6">
            <h2 className="text-headline-md text-primary not-italic">Next Study Plan</h2>
            <div className="mt-6 space-y-4">
              {nextSteps.slice(0, 4).map((step, index) => (
                <div key={`${step}-${index}`} className="border-l border-blueprint-line pl-4">
                  <p className="text-ui-label text-blueprint-muted">Day {index + 1}</p>
                  <p className="mt-1 text-body-md text-blueprint-muted">{step}</p>
                </div>
              ))}
            </div>
          </article>

          {reviewDetails.length ? (
            <article className="surface-card lg:col-span-12">
              <h2 className="text-headline-md text-primary not-italic">Question Review</h2>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {reviewDetails.map((detail, index) => (
                  <div key={detail.questionId} className="surface-inset">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-blueprint-line bg-white px-3 py-1 text-ui-label text-blueprint-muted">Question {index + 1}</span>
                      <span className={`rounded-full px-3 py-1 text-ui-label ${detail.isCorrect ? 'bg-[#e8f5e9] text-[#1b5e20]' : 'bg-[#fdecec] text-[#9f1d1d]'}`}>
                        {detail.isCorrect ? 'Correct' : 'Needs work'}
                      </span>
                    </div>
                    <p className="mt-4 text-body-md font-medium text-primary">{detail.prompt}</p>
                    <p className="mt-3 text-body-md text-blueprint-muted">Your answer: {detail.submittedAnswer ?? 'No answer submitted'}</p>
                    <p className="mt-2 text-body-md text-primary">Expected: {detail.correctAnswer}</p>
                    <p className="mt-3 text-body-md text-blueprint-muted">{detail.explanation}</p>
                    {detail.observations.length ? <p className="mt-3 text-body-md text-blueprint-muted">{detail.observations.join(' ')}</p> : null}
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      </main>
    </div>
  );
}
