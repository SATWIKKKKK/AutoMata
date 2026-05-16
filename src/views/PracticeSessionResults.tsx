import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, LoaderCircle, RotateCcw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchPracticeSession,
  formatPracticeDuration,
  togglePracticeSessionSaved,
  type PracticeSession,
} from '../lib/practiceSessions';

function scoreFraction(session: PracticeSession) {
  return `${session.correctAnswers}/${session.totalQuestions}`;
}

export default function PracticeSessionResults() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const sessionId = String(params.sessionId ?? '').trim();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Practice session not found.');
      setLoading(false);
      return;
    }
    let ignore = false;
    setLoading(true);
    void fetchPracticeSession(sessionId).then((result) => {
      if (ignore) return;
      setLoading(false);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      if (result.data.status !== 'completed') {
        navigate(`/round/practice/${result.data.id}`, { replace: true });
        return;
      }
      setSession(result.data);
    });
    return () => {
      ignore = true;
    };
  }, [navigate, sessionId]);

  const handleToggleSaved = async () => {
    if (!session) return;
    setSaving(true);
    const result = await togglePracticeSessionSaved(session.id, !session.savedAt);
    setSaving(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setSession((current) => current ? { ...current, savedAt: result.data } : current);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-3 rounded-full border border-blueprint-line bg-card px-5 py-3 text-body-md text-primary">
          <LoaderCircle size={18} className="animate-spin" /> Loading results...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-blueprint-line bg-card p-6 text-center shadow-xl">
          <p className="text-ui-label text-blueprint-muted">Practice Results</p>
          <h1 className="mt-2 text-headline-md text-primary not-italic">{error ?? 'No completed practice session was found.'}</h1>
          <button type="button" onClick={() => navigate('/practice-tracks')} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">
            Back to Practice Tracks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-14">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360 space-y-6">
        <section className="rounded-3xl border border-blueprint-line bg-card p-6 shadow-[0_24px_48px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4 border-b border-blueprint-line pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-ui-label text-blueprint-muted">{session.domainLabel} Practice Result</p>
              <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] leading-tight text-primary">{session.topic}</h1>
              <p className="mt-3 max-w-3xl text-body-md text-blueprint-muted">
                Deterministic scoring with question-by-question review and weak-tag follow-up.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => { void handleToggleSaved(); }}
              className="inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary"
            >
              {session.savedAt ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {saving ? 'Saving...' : session.savedAt ? 'Saved Session' : 'Save Session'}
            </button>
          </div>

          {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-blueprint-line bg-[#fbf9f9] p-4">
              <p className="text-ui-label text-blueprint-muted">Score</p>
              <p className="mt-2 text-headline-md text-primary not-italic">{scoreFraction(session)}</p>
            </div>
            <div className="rounded-2xl border border-blueprint-line bg-[#fbf9f9] p-4">
              <p className="text-ui-label text-blueprint-muted">Percentage</p>
              <p className="mt-2 text-headline-md text-primary not-italic">{session.score ?? 0}%</p>
            </div>
            <div className="rounded-2xl border border-blueprint-line bg-[#fbf9f9] p-4">
              <p className="text-ui-label text-blueprint-muted">Performance</p>
              <p className="mt-2 text-headline-md text-primary not-italic">{session.performanceLabel ?? 'Needs Review'}</p>
            </div>
            <div className="rounded-2xl border border-blueprint-line bg-[#fbf9f9] p-4">
              <p className="text-ui-label text-blueprint-muted">Time Taken</p>
              <p className="mt-2 text-headline-md text-primary not-italic">{formatPracticeDuration(session.timeSpentSeconds)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-blueprint-line bg-card p-6">
          <div className="flex flex-col gap-4 border-b border-blueprint-line pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-ui-label text-blueprint-muted">Tag Review</p>
              <h2 className="mt-1 text-headline-md text-primary not-italic">What to practice next</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/practice-tracks?search=${encodeURIComponent(session.weakTags[0] ?? session.topic)}`)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-ui-label text-white"
            >
              <RotateCcw size={16} /> Practice Weakest Tag Again
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-ui-label text-blueprint-muted">Covered Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {session.coveredTags.length ? session.coveredTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-blueprint-line bg-[#f5f3f3] px-3 py-1 text-ui-label text-primary">{tag}</span>
                )) : <span className="text-body-md text-blueprint-muted">No tags recorded.</span>}
              </div>
            </div>
            <div>
              <p className="text-ui-label text-blueprint-muted">Weak Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {session.weakTags.length ? session.weakTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-ui-label text-amber-950 dark:border-amber-300/50 dark:bg-amber-500/20 dark:text-amber-100">{tag}</span>
                )) : <span className="text-body-md text-blueprint-muted">No weak tags detected in this session.</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-blueprint-line bg-card p-6">
          <div className="border-b border-blueprint-line pb-4">
            <p className="text-ui-label text-blueprint-muted">Question Review</p>
            <h2 className="mt-1 text-headline-md text-primary not-italic">Breakdown</h2>
          </div>
          <div className="mt-5 space-y-4">
            {session.results.map((result, index) => (
              <details key={result.questionId} className="rounded-2xl border border-blueprint-line bg-[#fbf9f9] p-4" open={index === 0}>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-ui-label text-blueprint-muted">Question {index + 1}</p>
                      <p className="mt-1 text-body-md font-medium text-primary">{result.question}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-ui-label ${result.isCorrect ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                      {result.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                </summary>
                <div className="mt-4 space-y-3 text-body-md text-primary">
                  <p><span className="font-medium">Your answer:</span> {result.userAnswer || 'Skipped'}</p>
                  {!result.isCorrect ? <p><span className="font-medium">Correct answer:</span> {result.correctAnswer}</p> : null}
                  <p><span className="font-medium">Explanation:</span> {result.explanation || 'No explanation provided.'}</p>
                  {result.tags.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {result.tags.map((tag) => (
                        <span key={`${result.questionId}-${tag}`} className="rounded-full border border-blueprint-line bg-white px-3 py-1 text-ui-label text-primary">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
