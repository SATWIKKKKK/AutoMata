import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bookmark, BookmarkCheck, History, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DOMAIN_LABELS, updatePrepWorkspace } from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';
import {
  fetchPracticeOverview,
  searchPracticeSession,
  togglePracticeSessionSaved,
  type PracticeSessionSummary,
} from '../lib/practiceSessions';
import { updateUserPreferences } from '../lib/userPreferences';

function formatSessionDate(value: string | null) {
  if (!value) return 'Not saved';
  return new Date(value).toLocaleDateString();
}

function sessionScoreLabel(session: PracticeSessionSummary) {
  if (session.score === null) return 'In progress';
  return `${session.correctAnswers}/${session.totalQuestions} · ${session.score}%`;
}

export default function Workflows() {
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = usePrepWorkspace();
  const domain = workspace.selections.domain;
  const domainLabel = DOMAIN_LABELS[domain] ?? 'Selected Domain';
  const initialSearch = useMemo(() => new URLSearchParams(location.search).get('search') ?? '', [location.search]);
  const [topic, setTopic] = useState(initialSearch);
  const [overview, setOverview] = useState<{ suggestedTopics: string[]; history: PracticeSessionSummary[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingTopic, setSubmittingTopic] = useState<string | null>(null);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [error, setError] = useState<{ message: string; suggestedDomain?: string } | null>(null);

  const displayedSuggestions = useMemo(() => {
    const suggestions = overview?.suggestedTopics ?? [];
    if (!suggestions.length) return [];
    const offset = suggestionOffset % suggestions.length;
    return [...suggestions.slice(offset), ...suggestions.slice(0, offset)];
  }, [overview?.suggestedTopics, suggestionOffset]);

  useEffect(() => {
    setTopic(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (!displayedSuggestions.length) return undefined;
    const timer = window.setInterval(() => setSuggestionOffset((current) => current + 3), 4500);
    return () => window.clearInterval(timer);
  }, [displayedSuggestions.length]);

  useEffect(() => {
    if (!domain) {
      setError({ message: 'Choose your interview domain in onboarding before opening practice sessions.' });
      return;
    }

    let ignore = false;
    setLoading(true);
    void fetchPracticeOverview(domain).then((result) => {
      if (ignore) return;
      setLoading(false);
      if (result.ok === false) {
        setOverview(null);
        setError({ message: result.error, suggestedDomain: result.suggestedDomain });
        return;
      }
      setOverview({ suggestedTopics: result.data.suggestedTopics, history: result.data.history });
    });

    return () => {
      ignore = true;
    };
  }, [domain]);

  const launchTopic = async (rawTopic?: string) => {
    const nextTopic = (rawTopic ?? topic).trim();
    if (!nextTopic || !domain) return;
    setSubmittingTopic(nextTopic);
    setError(null);
    const result = await searchPracticeSession({
      domain,
      topic: nextTopic,
      level: workspace.selections.experienceLevel || 'intermediate',
    });
    setSubmittingTopic(null);
    if (result.ok === false) {
      setError({ message: result.error, suggestedDomain: result.suggestedDomain });
      return;
    }
    navigate(`/round/practice/${result.data.id}`);
  };

  const handleToggleSaved = async (session: PracticeSessionSummary) => {
    const result = await togglePracticeSessionSaved(session.id, !session.savedAt);
    if (result.ok === false) {
      setError({ message: result.error });
      return;
    }
    setOverview((current) => current ? {
      ...current,
      history: current.history.map((item) => item.id === session.id ? { ...item, savedAt: result.data } : item),
    } : current);
  };

  const handleSwitchSuggestedDomain = async () => {
    if (!error?.suggestedDomain) return;
    const nextDomain = error.suggestedDomain;
    updatePrepWorkspace({ selections: { ...workspace.selections, domain: nextDomain } });
    void updateUserPreferences({ domain: nextDomain }).catch(() => undefined);
    setError(null);
  };

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-10 xl:px-14">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360 space-y-6">
        <section className="rounded-[28px] border border-blueprint-line bg-card p-6 shadow-[0_24px_48px_rgba(0,0,0,0.06)] sm:p-8">
          <div className="flex flex-col gap-5 border-b border-blueprint-line pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-ui-label text-blueprint-muted">Practice Tracks</p>
              <h1 className="mt-2 font-serif text-[clamp(2.2rem,4vw,4rem)] leading-tight text-primary">{domainLabel}</h1>
              <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
                Search any topic, validate it against your selected domain, and generate a fresh 30-question session on demand.
              </p>
            </div>
          </div>

          <form
            className="mt-6 rounded-[24px] border border-blueprint-line bg-[#fbf9f9] p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void launchTopic();
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-blueprint-line bg-white px-4 py-3">
                <Search size={18} className="text-blueprint-muted" />
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder={`Search a ${domainLabel.toLowerCase()} topic like "${overview?.suggestedTopics?.[0] ?? 'React Hooks'}"`}
                  className="w-full border-0 bg-transparent text-body-lg text-primary outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!topic.trim() || Boolean(submittingTopic)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-ui-label text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingTopic ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {submittingTopic ? 'Generating...' : 'Search'}
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-body-md text-red-700">
                <p>{error.message}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {error.suggestedDomain ? (
                    <button
                      type="button"
                      onClick={() => { void handleSwitchSuggestedDomain(); }}
                      className="rounded-full bg-white px-4 py-2 text-ui-label text-primary"
                    >
                      Switch to {DOMAIN_LABELS[error.suggestedDomain] ?? error.suggestedDomain}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setTopic('');
                      setError(null);
                    }}
                    className="rounded-full border border-red-200 bg-transparent px-4 py-2 text-ui-label text-red-700"
                  >
                    Search something else
                  </button>
                </div>
              </div>
            ) : null}
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-ui-label text-blueprint-muted">
              <Sparkles size={15} /> Suggested topics for {domainLabel}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {displayedSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setTopic(suggestion);
                    void launchTopic(suggestion);
                  }}
                  className="rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-blueprint-line bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-3 border-b border-blueprint-line pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-ui-label text-blueprint-muted">
                <History size={15} /> Session History
              </div>
              <h2 className="mt-1 text-headline-md text-primary not-italic">Recent topic sessions</h2>
            </div>
            {loading ? <span className="inline-flex items-center gap-2 text-ui-label text-blueprint-muted"><LoaderCircle size={15} className="animate-spin" /> Refreshing</span> : null}
          </div>

          {overview?.history?.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {overview.history.map((session) => (
                <article key={session.id} className="rounded-2xl border border-blueprint-line bg-[#fbf9f9] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-ui-label text-blueprint-muted">{formatSessionDate(session.generatedAt)}</p>
                      <h3 className="mt-1 text-body-lg font-medium text-primary">{session.topic}</h3>
                      <p className="mt-2 text-body-md text-blueprint-muted">{sessionScoreLabel(session)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { void handleToggleSaved(session); }}
                      className="inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-white px-3 py-2 text-ui-label text-primary"
                    >
                      {session.savedAt ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                      {session.savedAt ? 'Saved' : 'Save'}
                    </button>
                  </div>

                  {session.weakTags?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(session.weakTags ?? []).slice(0, 3).map((tag) => (
                        <span key={`${session.id}-${tag}`} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-ui-label text-amber-950 dark:border-amber-300/50 dark:bg-amber-500/20 dark:text-amber-100">{tag}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    {session.status === 'completed' ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/results/practice/${session.id}`)}
                        className="rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary"
                      >
                        View Results
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/round/practice/${session.id}`)}
                        className="rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary"
                      >
                        Resume Session
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(submittingTopic)}
                      onClick={() => { void launchTopic(session.topic); }}
                      className="rounded-full bg-primary px-4 py-2 text-ui-label text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Retry Topic
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-blueprint-line bg-[#fbf9f9] p-5">
              <p className="text-body-md font-medium text-primary">No topic sessions yet.</p>
              <p className="mt-2 text-body-md text-blueprint-muted">Search a topic above and your generated sessions will appear here with score, save toggle, and retry controls.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
