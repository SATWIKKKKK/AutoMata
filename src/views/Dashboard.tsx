import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GapAnalysisDashboard } from '../components/ModulePlaceholders';
import { PlaceholdersAndVanishInput } from '../components/ui/placeholders-and-vanish-input';
import { fetchQuestionStats } from '../lib/questionBankApi';
import { listGithubRepos } from '../lib/githubRepos';
import {
  COMPANY_TYPE_LABELS,
  DOMAIN_LABELS,
  getStoredPrepWorkspace,
  INTERVIEW_TYPE_LABELS,
  TIMELINE_LABELS,
} from '../lib/prep';

function buildUpcomingSessions(domain: string) {
  switch (domain) {
    case 'backend':
      return [
        { initials: 'AP', title: 'API Design Round', meta: 'Today • Rate limiting, retries, and safe writes' },
        { initials: 'SC', title: 'Scenario-Based Backend Test', meta: 'Today • Idempotency and failure handling' },
        { initials: 'PJ', title: 'Project Walkthrough Drill', meta: 'Tomorrow • Service boundaries and tradeoffs' },
      ];
    case 'full-stack':
      return [
        { initials: 'FS', title: 'Full Stack Build Round', meta: 'Today • UI state, API contracts, and fallbacks' },
        { initials: 'DB', title: 'Debugging Round', meta: 'Today • Reproduce the issue and explain the fix' },
        { initials: 'PJ', title: 'Project Deep Dive', meta: 'Tomorrow • Architecture, ownership, and tradeoffs' },
      ];
    case 'ai-ml':
      return [
        { initials: 'ML', title: 'Model Reasoning Round', meta: 'Today • Metrics, failure modes, and tradeoffs' },
        { initials: 'RT', title: 'Retrieval Scenario Test', meta: 'Today • Ranking, chunking, and evaluation' },
        { initials: 'PJ', title: 'Project Walkthrough Drill', meta: 'Tomorrow • Training pipeline and serving path' },
      ];
    default:
      return [
        { initials: 'FE', title: 'Frontend Machine Coding Session', meta: 'Today • State flow, async UI, and edge cases' },
        { initials: 'RD', title: 'React Debugging Round', meta: 'Today • Effects, stale state, and fixes' },
        { initials: 'PJ', title: 'Project Walkthrough Drill', meta: 'Tomorrow • Tradeoffs, architecture, and follow-ups' },
      ];
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [repoCount, setRepoCount] = useState(0);
  const [pendingRepoName, setPendingRepoName] = useState<string | null>(null);
  const plan = workspace.prepPlan;
  const domainLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend';
  const interviewTypeLabel = INTERVIEW_TYPE_LABELS[workspace.selections.interviewType] ?? 'Interview';
  const companyTypeLabel = COMPANY_TYPE_LABELS[workspace.selections.companyType] ?? 'Product Company';
  const timelineLabel = TIMELINE_LABELS[workspace.selections.timeline] ?? '7 Days';
  const focusAreas = plan?.focusAreas.slice(0, 3) ?? ['Async state handling', 'Project walkthrough', 'Edge-case debugging'];
  const weakPoints = workspace.repoAnalysis?.weakPoints ?? workspace.manualAnalysis?.gapsThatMightExist ?? ['State updates under async pressure', 'Follow-up depth on project tradeoffs'];
  const prepScore = Math.min(96, 62 + (plan ? 12 : 0) + (workspace.repoAnalysis || workspace.manualAnalysis ? 10 : 0) + (workspace.diagnosticQuestions.length ? 8 : 0));
  const sessions = buildUpcomingSessions(workspace.selections.domain);
  const projectTopics = workspace.repoAnalysis?.projectSpecificQuestions?.length
    ? workspace.repoAnalysis.projectSpecificQuestions
    : (workspace.repoAnalysis?.interviewableTopics ?? workspace.manualAnalysis?.projectSpecificQuestions ?? workspace.manualAnalysis?.whatInterviewerWillFocus ?? []);
  const searchPlaceholders = [
    `Search ${domainLabel} questions`,
    'Find scenario drills by weak area',
    'Open FAANG tagged questions',
    'Practice project follow-ups',
  ];
  const signals = [
    {
      title: `Spend the next block on ${weakPoints[0]}.`,
      body: `This is the place most likely to slow you down in a ${companyTypeLabel.toLowerCase()} round. Put one short drill here before your next timed session.`,
      timestamp: 'Today',
    },
    {
      title: `Keep ${focusAreas[0]} warm, then move on.`,
      body: `You already have enough stability here to get through the opening part of the round. Save the longer block for ${focusAreas[1]}.`,
      timestamp: timelineLabel,
    },
    {
      title: 'Projects will come up early.',
      body: plan?.projectRelevance || 'Expect a project discussion before or right after the coding round, so tighten the story around your decisions and tradeoffs.',
      timestamp: 'Before the next interview',
    },
  ];

  useEffect(() => {
    let ignore = false;
    void fetchQuestionStats().then((result) => {
      if (!result.ok || ignore) return;
      const matching = result.data.find((item) => item.id === workspace.selections.domain);
      setQuestionCount(matching?.total ?? 0);
    });
    return () => {
      ignore = true;
    };
  }, [workspace.selections.domain]);

  useEffect(() => {
    let ignore = false;
    void listGithubRepos().then((data) => {
      if (ignore) return;
      setRepoCount(data.repos.length);
      setPendingRepoName(data.pendingJobs[0]?.repoName ?? null);
    }).catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-8 sm:px-8 lg:px-16">
        <section className="grid gap-4 border-b border-blueprint-line/70 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-display-xl text-primary">Prep Overview</h1>
            <p className="mt-3 text-body-lg text-blueprint-muted">
              See what matters most for your {domainLabel.toLowerCase()} {interviewTypeLabel.toLowerCase()} target and use that to choose your next round.
            </p>
            <div className="mt-6 max-w-xl">
              <PlaceholdersAndVanishInput
                placeholders={searchPlaceholders}
                onChange={(event) => setSearchQuery(event.target.value)}
                onSubmit={(event) => {
                  event.preventDefault();
                  navigate(`/question-bank?search=${encodeURIComponent(searchQuery.trim())}`);
                }}
              />
            </div>
          </div>
          <div className="hidden justify-end lg:flex">
            <button type="button" onClick={() => navigate('/question-bank')} className="rounded-full border border-blueprint-line bg-white px-5 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
              {questionCount} Questions Available
            </button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-12">
          {pendingRepoName ? (
            <button type="button" onClick={() => navigate('/github-repos')} className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-left text-body-md text-amber-800 lg:col-span-12">
              Your repo analysis for {pendingRepoName} is still processing. View results when a result exists.
            </button>
          ) : null}

          <article className="surface-card lg:col-span-4">
            <div className="flex items-start justify-between gap-4">
              <span className="text-ui-label text-blueprint-muted">Prep Readiness</span>
              <span className="rounded-full border border-blueprint-line bg-[#f5f3f3] px-4 py-2 text-ui-label text-primary">
                Updated Today
              </span>
            </div>
            <div className="mt-8 border-t border-blueprint-line pt-8">
              <p className="font-serif text-[clamp(4.5rem,12vw,120px)] leading-none tracking-[-0.04em] text-primary">
                {prepScore}<span className="ml-1 text-headline-lg text-blueprint-muted">%</span>
              </p>
              <p className="mt-6 max-w-xs text-body-md text-blueprint-muted">
                This is your current prep loop strength for the {companyTypeLabel.toLowerCase()} track. Next up: {focusAreas[0]} and {focusAreas[1]}.
              </p>
            </div>
          </article>

          <GapAnalysisDashboard className="lg:col-span-8" />

          <article className="surface-card lg:col-span-12">
            <div className="mb-6 flex flex-col gap-4 border-b border-blueprint-line pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-headline-md text-primary not-italic">Project Intelligence</h2>
                <p className="mt-2 text-body-md text-blueprint-muted">
                  {projectTopics.length ? 'Top interviewer prompts from your project context.' : 'Add a project to unlock repo-specific questions and stricter follow-ups.'}
                </p>
              </div>
              <button type="button" onClick={() => navigate('/onboarding')} className="rounded-full border border-blueprint-line bg-white px-5 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
                {projectTopics.length ? 'Update Project' : 'Add Project'}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(projectTopics.length ? projectTopics.slice(0, 3) : ['Explain the most important project tradeoff', 'Add a repository URL for code-aware prompts', 'Practice domain-level follow-ups']).map((topic, index) => (
                <div key={topic} className="surface-inset">
                  <span className="rounded-full bg-[#efeded] px-3 py-1.5 text-ui-label text-blueprint-muted">Prompt {index + 1}</span>
                  <p className="mt-4 text-body-md font-medium text-primary">{topic}</p>
                </div>
              ))}
            </div>
          </article>

          <button type="button" onClick={() => navigate('/github-repos')} className="surface-card text-left transition-colors hover:bg-[#f7f5f5] lg:col-span-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-headline-md text-primary not-italic">GitHub Repos Scanned</h2>
                <p className="mt-2 text-body-md text-blueprint-muted">Open your scanned repos and review generated project question sets.</p>
              </div>
              <span className="w-fit rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary">{repoCount} repos</span>
            </div>
          </button>

          <article className="surface-card lg:col-span-6">
            <div className="mb-6 flex items-end justify-between border-b border-blueprint-line pb-4">
              <h2 className="text-headline-md text-primary not-italic">Upcoming Sessions</h2>
              <button className="text-ui-label text-blueprint-muted transition-colors hover:text-primary">
                View All
              </button>
            </div>
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.title} className="flex items-center justify-between rounded-lg border border-transparent p-4 transition-colors hover:border-blueprint-line hover:bg-[#f5f3f3]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efeded] text-ui-label text-primary">
                      {session.initials}
                    </div>
                    <div>
                      <p className="text-body-md font-medium text-primary">{session.title}</p>
                      <p className="mt-1 text-body-md text-blueprint-muted">{session.meta}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => navigate('/practice-tracks')} className="text-ui-label text-blueprint-muted transition-colors hover:text-primary">Open</button>
                </div>
              ))}
            </div>
          </article>

          <article className="surface-card lg:col-span-6">
            <div className="mb-6 border-b border-blueprint-line pb-4">
              <h2 className="text-headline-md text-primary not-italic">Prep Insights</h2>
            </div>
            <div className="space-y-6">
              {signals.map((signal) => (
                <div key={signal.title} className="flex gap-4">
                  <div className="relative mt-2 w-px bg-blueprint-line">
                    <div className="absolute -left-[3px] top-0 h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <p className="text-body-md font-medium text-primary">{signal.title}</p>
                    <p className="mt-2 text-body-md text-blueprint-muted">{signal.body}</p>
                    <span className="mt-3 inline-block rounded border border-blueprint-line bg-[#f5f3f3] px-2 py-1 text-ui-label text-blueprint-muted">
                      {signal.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

