import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, RefreshCw, Trash2, X } from 'lucide-react';
import { GithubScanOverlay } from '../components/GithubRepoScanner';
import { deleteGithubRepo, getGithubQuestionSet, RepoQuestion, RepoQuestionSet } from '../lib/githubRepos';

const optionLetters = ['A', 'B', 'C', 'D'];

function difficultyClass(difficulty: RepoQuestion['difficulty']) {
  if (difficulty === 'hard') return 'bg-red-50 text-red-700 border-red-100';
  if (difficulty === 'medium') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
}

function highlightedCode(code: string) {
  const parts = code.split(/(\b(?:const|let|var|function|return|await|async|if|else|for|while|try|catch|throw|class|import|from|export|type|interface|new)\b|["'`][^"'`]*["'`])/g);
  return parts.map((part, index) => {
    if (/^(const|let|var|function|return|await|async|if|else|for|while|try|catch|throw|class|import|from|export|type|interface|new)$/.test(part)) {
      return <span key={`${part}-${index}`} className="text-sky-300">{part}</span>;
    }
    if (/^["'`]/.test(part)) {
      return <span key={`${part}-${index}`} className="text-emerald-300">{part}</span>;
    }
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function QuestionBody({ question }: { question: RepoQuestion }) {
  const parts: Array<{ type: 'text' | 'code'; value: string; language?: string }> = [];
  const regex = /```(\w+)?\s*([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(question.questionText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: question.questionText.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1] || 'code', value: match[2].trim() });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < question.questionText.length) {
    parts.push({ type: 'text', value: question.questionText.slice(lastIndex) });
  }

  if (!parts.length) parts.push({ type: 'text', value: question.questionText });

  return (
    <div className="space-y-4">
      {parts.map((part, index) => (
        part.type === 'code' ? (
          <pre key={`${question.id}-code-${index}`} className="overflow-x-auto rounded-lg border border-[#222] bg-[#111315] p-4 text-[13px] leading-6 text-slate-100">
            <code>{highlightedCode(part.value)}</code>
          </pre>
        ) : (
          <p key={`${question.id}-text-${index}`} className="whitespace-pre-wrap text-body-lg leading-8 text-primary">{part.value.trim()}</p>
        )
      ))}
    </div>
  );
}

function AnswerBlock({ answer }: { answer: string }) {
  const codeMatch = answer.match(/```(\w+)?\s*([\s\S]*?)```/);
  if (!codeMatch) {
    return <p className="whitespace-pre-wrap rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-body-md leading-7 text-emerald-900">{answer}</p>;
  }

  const before = answer.slice(0, codeMatch.index).trim();
  const code = codeMatch[2].trim();
  const after = answer.slice((codeMatch.index ?? 0) + codeMatch[0].length).trim();
  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-emerald-900">
      {before ? <p className="whitespace-pre-wrap text-body-md leading-7">{before}</p> : null}
      <pre className="my-3 overflow-x-auto rounded-lg border border-[#222] bg-[#111315] p-4 text-[13px] leading-6 text-slate-100">
        <code>{highlightedCode(code)}</code>
      </pre>
      {after ? <p className="whitespace-pre-wrap text-body-md leading-7">{after}</p> : null}
    </div>
  );
}

export default function GithubProjectQuestions() {
  const navigate = useNavigate();
  const { repoId = '' } = useParams<{ repoId: string }>();
  const [data, setData] = useState<RepoQuestionSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleAnswers, setVisibleAnswers] = useState<Record<string, boolean>>({});
  const [showWarning, setShowWarning] = useState(true);
  const [scanRequest, setScanRequest] = useState<{ repoUrl: string; nonce: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void getGithubQuestionSet(repoId).then(setData).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load questions.'));
  }, [repoId]);

  const rescan = () => {
    if (!data?.repo.repoUrl) return;
    setError(null);
    setScanRequest({ repoUrl: data.repo.repoUrl, nonce: Date.now() });
  };

  const removeRepo = async () => {
    if (!data) return;
    const confirmed = window.confirm(`Delete the saved scan for ${data.repo.repoName}? This removes its generated questions.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteGithubRepo(data.repo.id);
      navigate('/github-repos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete this repository scan.');
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-full bg-background p-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-blueprint-line bg-white p-6">
          <h1 className="text-headline-md text-primary">Analysis not ready</h1>
          <p className="mt-3 text-body-md text-blueprint-muted">{error}</p>
          <Link to="/github-repos" className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-ui-label text-white">
            Back to GitHub Repos
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return <div className="min-h-full bg-background p-8 text-blueprint-muted">Loading repository questions...</div>;
  const questionNumberById = new Map<string, number>();
  data.sections.flatMap((section) => section.questions).forEach((question, index) => {
    questionNumberById.set(question.id, index + 1);
  });
  const allAnswersVisible = data.sections.flatMap((section) => section.questions).every((question) => visibleAnswers[question.id]);
  const setAllAnswersVisible = (visible: boolean) => {
    const next: Record<string, boolean> = {};
    data.sections.flatMap((section) => section.questions).forEach((question) => {
      next[question.id] = visible;
    });
    setVisibleAnswers(next);
  };

  return (
    <div className="min-h-full scroll-smooth bg-[#fbfafa]">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-25" />
      <div className="relative z-10 mx-auto max-w-[1180px] px-4 py-8 lg:px-8">
        <main className="scroll-smooth">
          {showWarning && data.warnings?.length ? (
            <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-body-md text-amber-800">
              <p>Limited files found in this repository. Questions are based on available content and may be fewer than usual.</p>
              <button type="button" onClick={() => setShowWarning(false)} aria-label="Dismiss warning" className="text-amber-700 hover:text-amber-900">
                <X size={16} />
              </button>
            </div>
          ) : null}
          <div className="border-b border-blueprint-line pb-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-display-xl text-primary">{data.repo.repoName}</h1>
                {(data.detectedDomains ?? []).map((domain) => (
                  <span key={domain} className="rounded-full border border-blueprint-line bg-white px-3 py-1.5 text-ui-label text-blueprint-muted">{domain}</span>
                ))}
              </div>
              <p className="mt-3 text-ui-label text-blueprint-muted">Brief summary</p>
              <p className="mt-2 max-w-4xl text-body-lg leading-8 text-blueprint-muted">{data.projectSummary}</p>
            </div>
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-blueprint-line bg-white/88 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.03)] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-ui-label text-blueprint-muted">Question set actions</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => setAllAnswersVisible(!allAnswersVisible)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blueprint-line bg-white px-4 py-2.5 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
                  <Check size={14} /> {allAnswersVisible ? 'Hide Answers' : 'Show Answers'}
                </button>
                <button type="button" onClick={rescan} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031]">
                  <RefreshCw size={14} /> Re-scan
                </button>
                <button type="button" disabled={deleting} onClick={() => void removeRepo()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-ui-label text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>

          {data.sections.some((section) => section.questions.some((question) => !question.correctAnswer)) ? (
            <div className="mt-6 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-body-md text-amber-800 sm:flex-row sm:items-center sm:justify-between">
              <p>Some older questions in this saved scan do not have answers. Re-scan this repository to regenerate all questions with proper answers.</p>
              <button type="button" onClick={rescan} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-900 px-4 py-2.5 text-ui-label text-white transition-colors hover:bg-amber-950">
                <RefreshCw size={14} /> Re-scan now
              </button>
            </div>
          ) : null}

          <nav className="sticky top-16 z-30 mt-6 flex gap-2 overflow-x-auto border-b border-blueprint-line bg-[#fbfafa]/95 py-3 backdrop-blur">
            {data.sections.map((section) => (
              <a key={section.sectionId} href={`#${section.sectionId}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary transition-colors hover:bg-primary hover:text-white">
                <span>{section.sectionTitle}</span>
                <span className="rounded-full border border-current px-2 py-0.5">{section.questions.length}</span>
              </a>
            ))}
          </nav>

          <div className="mt-12 space-y-14">
            {data.sections.map((section) => (
              <section key={section.sectionId} id={section.sectionId} className="scroll-mt-8 border-t border-blueprint-line pt-8">
                <div className="mb-6">
                  <h2 className="text-headline-md text-primary">{section.sectionTitle}</h2>
                  <p className="mt-2 text-body-md text-blueprint-muted">{section.sectionDescription}</p>
                </div>
                <div className="space-y-5">
                  {section.questions.map((question, index) => (
                    <article key={question.id} className="rounded-lg border border-blueprint-line bg-white/86 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-ui-label text-blueprint-muted">Question {questionNumberById.get(question.id) ?? index + 1}</span>
                        <span className={`rounded-full border px-2 py-1 text-ui-label ${difficultyClass(question.difficulty)}`}>{question.difficulty}</span>
                        <span className="rounded-full bg-[#efeded] px-2 py-1 text-ui-label text-blueprint-muted">{question.conceptTag}</span>
                      </div>
                      <QuestionBody question={question} />
                      <div className="mt-4 space-y-2">
                        {question.options?.length ? (
                          <>
                          {question.options.map((option, optionIndex) => (
                            <div key={option} className="flex gap-3 rounded-lg border border-blueprint-line bg-[#fbfafa] px-3 py-2 text-body-md text-blueprint-muted">
                              <span className="font-semibold text-primary">{optionLetters[optionIndex] ?? optionIndex + 1}</span>
                              <span>{option}</span>
                            </div>
                          ))}
                          </>
                        ) : null}
                        {question.correctAnswer ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setVisibleAnswers((answers) => ({ ...answers, [question.id]: !answers[question.id] }))}
                              className="mt-2 inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]"
                            >
                              <Check size={14} /> {visibleAnswers[question.id] ? 'Hide Answer' : 'Show Answer'}
                            </button>
                            {visibleAnswers[question.id] ? <AnswerBlock answer={question.correctAnswer} /> : null}
                          </>
                        ) : (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-body-md text-amber-800">
                            No answer was saved for this older question. Re-scan this repository to regenerate it with proper answers.
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-ui-label text-blueprint-muted">{question.fileReference}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
      {scanRequest ? (
        <GithubScanOverlay
          key={scanRequest.nonce}
          repoUrl={scanRequest.repoUrl}
          force
          onClose={() => setScanRequest(null)}
          onError={setError}
        />
      ) : null}
    </div>
  );
}
