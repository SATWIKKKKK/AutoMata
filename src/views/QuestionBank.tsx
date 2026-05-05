import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchQuestions, fetchQuestionStats } from '../lib/questionBankApi';
import type { BankQuestion, QuestionType } from '../lib/questionBank';
import { getStoredPrepWorkspace } from '../lib/prep';

const QUESTION_TYPES: Array<{ id: QuestionType; label: string }> = [
  { id: 'mcq', label: 'Concept MCQ' },
  { id: 'fill_blank', label: 'Fill in the Blank' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'system_design', label: 'Architecture' },
  { id: 'coding', label: 'Coding Round' },
  { id: 'mock', label: 'Mock Interview' },
];

function useInitialSearch() {
  const location = useLocation();
  return new URLSearchParams(location.search).get('search') ?? '';
}

export default function QuestionBank() {
  const initialSearch = useInitialSearch();
  const workspace = getStoredPrepWorkspace();
  const [domain, setDomain] = useState('all');
  const [type, setType] = useState<QuestionType | 'all'>('all');
  const [search, setSearch] = useState(initialSearch);
  const [faangOnly, setFaangOnly] = useState(false);
  const [stats, setStats] = useState<Array<{ id: string; label: string; total: number }>>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    void fetchQuestionStats().then((result) => {
      if (!result.ok || ignore) return;
      setStats(result.data);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    void fetchQuestions({ domain, type, search, faangOnly, limit: 120 }).then((result) => {
      if (ignore) return;
      if ('error' in result) {
        setError(result.error);
        setQuestions([]);
        setLoading(false);
        return;
      }
      setQuestions(result.data);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [domain, faangOnly, search, type]);

  const totalQuestions = stats.reduce((sum, item) => sum + item.total, 0);
  const projectQuestions = workspace.repoAnalysis?.projectSpecificQuestions ?? workspace.manualAnalysis?.projectSpecificQuestions ?? [];

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-360 space-y-8">
        <section className="grid gap-6 border-b border-blueprint-line pb-8 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="text-ui-label text-blueprint-muted">Question Bank</p>
            <h1 className="mt-2 text-display-xl text-primary">Static prep bank</h1>
            <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
              {totalQuestions.toLocaleString()} original non-DSA technical prompts across domains, rounds, scenarios, coding, architecture, and mock interview practice.
            </p>
          </div>
          <div className="surface-card-compact">
            <label className="text-ui-label text-blueprint-muted">Search questions</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search React, auth, Kafka, FAANG..."
              className="mt-2 w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none placeholder:text-blueprint-muted focus:border-primary"
            />
          </div>
        </section>

        {projectQuestions.length ? (
          <section className="surface-card space-y-5">
            <div>
              <p className="text-ui-label text-blueprint-muted">From your project scan</p>
              <h2 className="mt-2 text-headline-md text-primary not-italic">Project-specific interview questions</h2>
              <p className="mt-2 max-w-3xl text-body-md text-blueprint-muted">
                These prompts were generated from the repository or project description you added during onboarding.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {projectQuestions.slice(0, 6).map((question, index) => (
                <div key={`${question}-${index}`} className="surface-inset">
                  <span className="rounded-full bg-[#efeded] px-3 py-1.5 text-ui-label text-blueprint-muted">Project Prompt {index + 1}</span>
                  <p className="mt-4 text-body-md font-medium text-primary">{question}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-4">
            <div className="surface-card-compact">
              <p className="text-ui-label text-primary">Domain</p>
              <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {[{ id: 'all', label: 'All domains', total: totalQuestions }, ...stats].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDomain(item.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-body-md transition-colors ${domain === item.id ? 'bg-primary text-white' : 'text-blueprint-muted hover:bg-[#f5f3f3] hover:text-primary'}`}
                  >
                    <span>{item.label}</span>
                    <span className="text-ui-label">{item.total}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="surface-card-compact">
              <p className="text-ui-label text-primary">Round Type</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[{ id: 'all', label: 'All' }, ...QUESTION_TYPES].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as QuestionType | 'all')}
                    className={`rounded-full border px-4 py-2 text-ui-label transition-colors ${type === item.id ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-white text-blueprint-muted hover:text-primary'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFaangOnly((value) => !value)}
                className={`mt-4 rounded-full border px-4 py-2 text-ui-label transition-colors ${faangOnly ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-white text-blueprint-muted hover:text-primary'}`}
              >
                FAANG tagged only
              </button>
            </div>
          </aside>

          <section className="grid gap-4 xl:grid-cols-2">
            {loading ? <p className="text-body-md text-blueprint-muted">Loading questions…</p> : null}
            {error ? <p className="text-body-md text-red-600">{error}</p> : null}
            {questions.map((question) => (
              <article key={question.id} className="surface-card">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#efeded] px-3 py-1.5 text-ui-label text-primary">{question.domainLabel}</span>
                  <span className="rounded-full border border-blueprint-line bg-white px-3 py-1.5 text-ui-label text-blueprint-muted">{question.type.replace('_', ' ')}</span>
                  <span className="rounded-full border border-blueprint-line bg-white px-3 py-1.5 text-ui-label text-blueprint-muted">D{question.difficulty}</span>
                  {question.tags.includes('faang') ? <span className="rounded-full border border-blueprint-line bg-[#f5f3f3] px-3 py-1.5 text-ui-label text-primary">FAANG</span> : null}
                </div>
                <p className="text-ui-label text-blueprint-muted">{question.topic}</p>
                <h2 className="mt-2 text-body-lg font-semibold text-primary">{question.questionText}</h2>
                {question.codeSnippet ? (
                  <pre className="surface-inset mt-4 overflow-x-auto text-[13px] leading-6 text-blueprint-muted"><code>{question.codeSnippet}</code></pre>
                ) : null}
                {question.options?.length ? (
                  <div className="mt-4 grid gap-2">
                    {question.options.map((option) => (
                      <div key={option} className="surface-inset px-3 py-2 text-body-md text-blueprint-muted">
                        {option}
                      </div>
                    ))}
                  </div>
                ) : null}
                <details className="surface-inset mt-4 p-3">
                  <summary className="cursor-pointer text-ui-label text-primary">Answer and explanation</summary>
                  <p className="mt-3 text-body-md text-primary">{question.correctAnswer}</p>
                  <p className="mt-2 text-body-md text-blueprint-muted">{question.explanation}</p>
                </details>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}
