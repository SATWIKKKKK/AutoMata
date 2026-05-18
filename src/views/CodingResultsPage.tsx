import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DOMAIN_LABELS } from '../lib/prep';
import { fetchCodingAttempt, submitCodingAttempt, type CodingAttempt } from '../lib/codingRound';

const SCORING_RUBRIC_ROWS = [
  ['1-2', 'Code does not compile or has fundamental logic errors that prevent it from running at all.'],
  ['3-4', 'Code runs but produces wrong output for most cases, missing core requirements.'],
  ['5', 'Code handles the basic happy path but fails edge cases and is missing requirements.'],
  ['6', 'Code mostly works, handles main cases, minor issues with edge cases or code quality.'],
  ['7', 'Code works correctly for all stated requirements, reasonable quality, minor improvements possible.'],
  ['8', 'Code works correctly, handles edge cases, clean readable structure, good naming.'],
  ['9', 'Code works correctly, handles all edge cases including unstated ones, excellent structure, production-ready.'],
  ['10', 'Exceptional — optimal approach, handles all cases, clean, well-named, would pass a strict senior engineer review immediately.'],
];

const DIMENSION_WEIGHTS = [
  ['correctness', 'Correctness', 40],
  ['codeQuality', 'Code Quality', 25],
  ['edgeCases', 'Edge Cases', 20],
  ['bestPractices', 'Best Practices', 15],
] as const;

function difficultyBadgeClass(difficulty: string) {
  if (difficulty === 'easy') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (difficulty === 'hard') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-300';
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-300';
}

function verdictBadgeClass(verdict: string) {
  if (verdict === 'pass') return 'border-[#16a34a] bg-[#16a34a] text-white dark:border-[#4ade80] dark:bg-[#4ade80] dark:text-[#052e16]';
  if (verdict === 'fail') return 'border-[#dc2626] bg-[#dc2626] text-white dark:border-[#f87171] dark:bg-[#f87171] dark:text-[#450a0a]';
  return 'border-[#b45309] bg-[#b45309] text-white dark:border-[#d97706] dark:bg-[#d97706] dark:text-[#431407]';
}

function edgeCasesClass(content: string) {
  const normalized = content.toLowerCase();
  const looksClean = (normalized.includes('handled') || normalized.includes('covered') || normalized.includes('clean'))
    && !normalized.includes('miss')
    && !normalized.includes('unhandled')
    && !normalized.includes('not ');
  return looksClean
    ? 'border-emerald-200 dark:border-emerald-500/50'
    : 'border-amber-200 dark:border-amber-500/50';
}

export default function CodingResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ attemptId?: string }>();
  const attemptId = String(params.attemptId ?? '').trim();
  const [attempt, setAttempt] = useState<CodingAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(() => new URLSearchParams(location.search).get('showNotes') === '1');
  const [scoreExplainerOpen, setScoreExplainerOpen] = useState(false);
  const notesSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setShowNotes(new URLSearchParams(location.search).get('showNotes') === '1');
  }, [location.search]);

  useEffect(() => {
    if (!showNotes) return;
    window.requestAnimationFrame(() => {
      notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [showNotes]);

  useEffect(() => {
    if (!attemptId) {
      setError('Coding attempt id is missing.');
      setLoading(false);
      return;
    }
    let ignore = false;
    setLoading(true);
    setError(null);
    void fetchCodingAttempt(attemptId).then((result) => {
      if (ignore) return;
      setLoading(false);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setAttempt(result.data);
    });
    return () => {
      ignore = true;
    };
  }, [attemptId]);

  const evaluation = attempt?.evaluation ?? null;
  const problem = attempt?.problem ?? null;
  const aiUnavailable = attempt?.aiUnavailable ?? false;
  const domainLabel = useMemo(() => DOMAIN_LABELS[problem?.domain ?? ''] ?? problem?.domain ?? 'Domain', [problem?.domain]);
  const dimensionScores = useMemo(() => {
    if (!evaluation) return null;
    return evaluation.dimensionScores ?? {
      correctness: evaluation.score,
      codeQuality: evaluation.score,
      edgeCases: evaluation.score,
      bestPractices: evaluation.score,
    };
  }, [evaluation]);

  const handleRetryEvaluation = async () => {
    if (!attempt || !problem || retrying) return;
    setRetrying(true);
    setRetryError(null);
    const result = await submitCodingAttempt(attempt.id, {
      code: attempt.code,
      notes: attempt.notes,
      timeSpentSeconds: attempt.timeSpentSeconds ?? undefined,
      difficulty: problem.difficulty,
      domain: problem.domain,
      language: attempt.language,
    });
    if (result.ok === false) {
      setRetryError(result.error);
      const refreshed = await fetchCodingAttempt(attempt.id);
      if (refreshed.ok === true) {
        setAttempt(refreshed.data);
      }
      setRetrying(false);
      return;
    }
    setAttempt(result.data);
    setRetrying(false);
  };

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-6xl space-y-6">
        {loading ? (
          <section className="surface-card">
            <p className="text-body-md text-blueprint-muted">Loading coding results...</p>
          </section>
        ) : null}

        {error ? (
          <section className="surface-card">
            <p className="text-body-md text-red-700">{error}</p>
          </section>
        ) : null}

        {attempt && problem && aiUnavailable ? (
          <section className="rounded-[28px] border border-red-200 bg-card p-6 shadow-[0_24px_48px_rgba(0,0,0,0.06)] dark:border-red-500/50 sm:p-8">
            <p className="text-ui-label tracking-[0.22em] text-red-700 dark:text-red-300">EVALUATION UNAVAILABLE</p>
            <h1 className="mt-4 text-display-lg text-primary">DeepSeek could not evaluate your submission.</h1>
            <p className="mt-3 text-body-lg text-blueprint-muted">Your code is saved. Retry the evaluation to generate strict scoring and real feedback.</p>
            {attempt.evaluationError ? <p className="mt-4 text-body-md text-red-700 dark:text-red-300">{attempt.evaluationError}</p> : null}
            {retryError ? <p className="mt-3 text-body-md text-red-700 dark:text-red-300">{retryError}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => { void handleRetryEvaluation(); }}
                disabled={retrying}
                className="rounded-full bg-primary px-6 py-3 text-ui-label text-white hover:bg-[#303031] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retrying ? 'Retrying...' : 'Retry Evaluation'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/coding-round')}
                className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]"
              >
                Back To Coding Round
              </button>
              <button
                type="button"
                onClick={() => setShowNotes((current) => !current)}
                className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]"
              >
                {showNotes ? 'Hide Notes' : 'See Notes'}
              </button>
            </div>
          </section>
        ) : null}

        {attempt && problem && evaluation && !aiUnavailable ? (
          <>
            <section className="rounded-[28px] border border-blueprint-line bg-card p-6 shadow-[0_24px_48px_rgba(0,0,0,0.06)] sm:p-8">
              <p className="text-ui-label tracking-[0.22em] text-blueprint-muted">CODING RESULTS</p>
              <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-display-xl text-primary">{problem.title}</h1>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-ui-label ${difficultyBadgeClass(problem.difficulty)}`}>{problem.difficulty}</span>
                    <span className="rounded-full border border-blueprint-line bg-blueprint-bg px-3 py-1 text-ui-label text-primary">{domainLabel}</span>
                    <span className={`rounded-full border px-3 py-1 text-ui-label ${verdictBadgeClass(evaluation.verdict)}`}>{evaluation.verdict}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScoreExplainerOpen(true)}
                  className="rounded-[24px] border border-blueprint-line bg-blueprint-bg px-6 py-5 text-center transition-colors hover:bg-[#f5f3f3] dark:hover:bg-white/5"
                >
                  <p className="text-ui-label text-blueprint-muted">Score</p>
                  <p className="mt-2 font-serif text-[clamp(3rem,8vw,5rem)] leading-none text-primary">{evaluation.score}<span className="text-headline-md text-blueprint-muted">/10</span></p>
                </button>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-blueprint-line bg-card p-5">
                <p className="text-ui-label text-blueprint-muted">Correctness</p>
                <p className="mt-3 text-body-md text-primary">{evaluation.correctness}</p>
              </article>
              <article className="rounded-2xl border border-blueprint-line bg-card p-5">
                <p className="text-ui-label text-blueprint-muted">Code Quality</p>
                <p className="mt-3 text-body-md text-primary">{evaluation.codeQuality}</p>
              </article>
              <article className={`rounded-2xl border bg-card p-5 ${edgeCasesClass(evaluation.edgeCases)}`}>
                <p className="text-ui-label text-blueprint-muted">Edge Cases</p>
                <p className="mt-3 text-body-md text-primary">{evaluation.edgeCases}</p>
              </article>
              <article className="rounded-2xl border border-red-200 bg-card p-5 dark:border-red-500/50">
                <p className="text-ui-label text-red-700 dark:text-red-300">Improvements</p>
                <ul className="mt-3 space-y-2 text-body-md text-primary">
                  {evaluation.improvements.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            </section>

            <section className="rounded-2xl border border-[#b45309] bg-card p-6 dark:border-[#d97706]">
              <p className="text-ui-label text-[#b45309] dark:text-[#d97706]">Model Solution Sketch</p>
              <p className="mt-3 text-body-lg text-primary">{evaluation.modelSolutionSketch}</p>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/coding-round')}
                className="rounded-full bg-primary px-6 py-3 text-ui-label text-white hover:bg-[#303031]"
              >
                Try Another Problem
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]"
              >
                View Dashboard
              </button>
              <button
                type="button"
                onClick={() => setShowNotes((current) => !current)}
                className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]"
              >
                {showNotes ? 'Hide Notes' : 'See Notes'}
              </button>
            </div>
          </>
        ) : null}

        {attempt && showNotes ? (
          <section ref={notesSectionRef} className="rounded-2xl border border-blueprint-line bg-card p-6">
            <p className="text-ui-label text-blueprint-muted">Saved Notes</p>
            <p className="mt-3 whitespace-pre-wrap text-body-md text-primary">
              {attempt.notes.trim() || 'No saved notes were stored for this coding round.'}
            </p>
          </section>
        ) : null}
        {scoreExplainerOpen && evaluation && problem ? (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/45 px-4">
            <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-blueprint-line bg-card p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-ui-label text-blueprint-muted">Score Explainer</p>
                  <h2 className="mt-2 text-headline-md text-primary not-italic">How This Score Was Calculated</h2>
                </div>
                <button type="button" onClick={() => setScoreExplainerOpen(false)} className="rounded-full border border-blueprint-line px-4 py-2 text-ui-label text-primary">
                  Close
                </button>
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border border-blueprint-line">
                <table className="w-full text-left text-body-md text-primary">
                  <thead className="bg-blueprint-bg text-ui-label text-blueprint-muted">
                    <tr><th className="px-4 py-3">Score Range</th><th className="px-4 py-3">What It Means</th></tr>
                  </thead>
                  <tbody>
                    {SCORING_RUBRIC_ROWS.map(([range, meaning]) => (
                      <tr key={range} className="border-t border-blueprint-line">
                        <td className="px-4 py-3 font-semibold">{range}</td>
                        <td className="px-4 py-3">{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <section className="mt-5 rounded-xl border border-blueprint-line bg-blueprint-bg p-4">
                <p className="text-ui-label text-blueprint-muted">Problem Evaluation Criteria</p>
                <ul className="mt-3 space-y-2 text-body-md text-primary">
                  {problem.evaluationCriteria.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
              {dimensionScores ? (
                <section className="mt-5 rounded-xl border border-blueprint-line bg-card p-4">
                  <p className="text-ui-label text-blueprint-muted">Dimension Scores</p>
                  <div className="mt-4 space-y-4">
                    {DIMENSION_WEIGHTS.map(([key, label, weight]) => {
                      const value = Math.max(1, Math.min(10, Number(dimensionScores[key] ?? evaluation.score)));
                      const color = value >= 8 ? 'bg-emerald-500' : value >= 6 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between gap-3 text-ui-label">
                            <span className="text-primary">{label} · {weight}%</span>
                            <span className="text-blueprint-muted">{value}/10</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-blueprint-bg">
                            <div className={`h-full ${color}`} style={{ width: `${value * 10}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
