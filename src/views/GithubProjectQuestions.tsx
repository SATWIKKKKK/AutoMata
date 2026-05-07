import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getGithubQuestionSet, RepoQuestionSet } from '../lib/githubRepos';

export default function GithubProjectQuestions() {
  const { repoId = '' } = useParams<{ repoId: string }>();
  const [data, setData] = useState<RepoQuestionSet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getGithubQuestionSet(repoId).then(setData).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load questions.'));
  }, [repoId]);

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

  return (
    <div className="min-h-full bg-[#fbfafa]">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-25" />
      <div className="relative z-10 mx-auto grid max-w-[1320px] gap-10 px-4 py-8 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="hidden self-start border-r border-blueprint-line pr-8 lg:sticky lg:top-8 lg:block">
          <h2 className="text-headline-sm text-primary">{data.repo.repoName}</h2>
          <nav className="mt-8 space-y-3">
            {data.sections.map((section) => (
              <a key={section.sectionId} href={`#${section.sectionId}`} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-body-md text-blueprint-muted transition-colors hover:bg-white hover:text-primary">
                <span>{section.sectionTitle}</span>
                <span className="rounded-full border border-blueprint-line bg-white px-2 py-0.5 text-ui-label">{section.questions.length}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="max-w-4xl scroll-smooth">
          {data.warnings?.length ? (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-body-md text-amber-800">
              This repository has very few code files. Questions are based on limited information and may be general.
            </div>
          ) : null}
          <h1 className="text-display-xl text-primary">{data.repo.repoName}</h1>
          <p className="mt-5 text-body-lg leading-8 text-blueprint-muted">{data.projectSummary}</p>

          <div className="mt-12 space-y-14">
            {data.sections.map((section) => (
              <section key={section.sectionId} id={section.sectionId} className="scroll-mt-8 border-t border-blueprint-line pt-8">
                <div className="mb-6">
                  <h2 className="text-headline-md text-primary">{section.sectionTitle}</h2>
                  <p className="mt-2 text-body-md text-blueprint-muted">{section.sectionDescription}</p>
                </div>
                <div className="space-y-5">
                  {section.questions.map((question, index) => (
                    <article key={question.id} className="border-b border-blueprint-line pb-5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-ui-label text-blueprint-muted">Question {index + 1}</span>
                        <span className="rounded-full bg-[#efeded] px-2 py-1 text-ui-label text-blueprint-muted">{question.difficulty}</span>
                        <span className="rounded-full bg-[#efeded] px-2 py-1 text-ui-label text-blueprint-muted">{question.conceptTag}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-body-lg leading-8 text-primary">{question.questionText}</p>
                      {question.options?.length ? (
                        <ol className="mt-3 list-decimal space-y-1 pl-5 text-body-md text-blueprint-muted">
                          {question.options.map((option) => <li key={option}>{option}</li>)}
                        </ol>
                      ) : null}
                      <p className="mt-3 text-ui-label text-blueprint-muted">{question.fileReference}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
