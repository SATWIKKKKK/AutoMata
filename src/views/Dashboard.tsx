import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Github, Heart, Info, Play, TrendingUp, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getGithubScanJob, listGithubRepos } from '../lib/githubRepos';
import { fetchLatestRoundAttemptSummary, type StoredRoundAttempt } from '../lib/questionBankApi';
import { fetchPracticeSessions, type PracticeSessionSummary } from '../lib/practiceSessions';
import { BackgroundRippleEffect } from '../components/ui/background-ripple-effect';
import {
  COMPANY_TYPE_LABELS,
  DOMAIN_LABELS,
  getDomainFamily,
  INTERVIEW_TYPE_LABELS,
  TIMELINE_LABELS,
} from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';

type Recommendation = {
  initials: string;
  title: string;
  meta: string;
  reason: string;
  route: string;
};

function buildRecommendations(domain: string): Recommendation[] {
  switch (domain) {
    case 'backend':
      return [
        { initials: 'AP', title: 'API Design Round', meta: 'Contracts, retries, and safe writes', reason: 'Recommended because backend prep often exposes API tradeoff gaps first.', route: '/coding-round' },
        { initials: 'SC', title: 'Backend Scenario Round', meta: 'Idempotency, rate limits, and observability', reason: 'Recommended because scenario rounds create the strongest signal for readiness.', route: '/scenario-round' },
        { initials: 'QB', title: 'Backend Question Bank', meta: 'Focused backend prompts only', reason: 'Recommended to widen coverage before your next timed round.', route: '/question-bank?type=all' },
      ];
    case 'full-stack':
      return [
        { initials: 'FS', title: 'Full Stack Build Round', meta: 'UI state, API contracts, and persistence', reason: 'Recommended because cross-layer reasoning is core to this domain.', route: '/coding-round' },
        { initials: 'DB', title: 'Cross-layer Debugging', meta: 'Trace client, server, and data flow', reason: 'Recommended to practice diagnosing failures end to end.', route: '/scenario-round' },
        { initials: 'QB', title: 'Full Stack Question Bank', meta: 'Questions for your selected domain', reason: 'Recommended to broaden coverage before timed practice.', route: '/question-bank?type=all' },
      ];
    case 'ai-ml':
      return [
        { initials: 'ML', title: 'Model Reasoning Round', meta: 'Metrics, failures, and tradeoffs', reason: 'Recommended because evaluation tradeoffs are common interview probes.', route: '/coding-round' },
        { initials: 'RT', title: 'Retrieval Scenario Round', meta: 'Chunking, ranking, and evaluation', reason: 'Recommended to connect model behavior with system design choices.', route: '/scenario-round' },
        { initials: 'QB', title: 'AI / ML Question Bank', meta: 'RAG, model, and pipeline prompts', reason: 'Recommended to cover fundamentals before deeper rounds.', route: '/question-bank?type=all' },
      ];
    case 'devops':
      return [
        { initials: 'CI', title: 'CI/CD Round', meta: 'Pipelines, deploy safety, and rollback', reason: 'Recommended because release safety is a high-signal DevOps area.', route: '/coding-round' },
        { initials: 'IR', title: 'Incident Scenario Round', meta: 'Observability and production response', reason: 'Recommended to build incident narration and prioritization.', route: '/scenario-round' },
        { initials: 'QB', title: 'DevOps Question Bank', meta: 'Infrastructure and reliability prompts', reason: 'Recommended to keep platform coverage balanced.', route: '/question-bank?type=all' },
      ];
    case 'data':
      return [
        { initials: 'ET', title: 'Pipeline Design Round', meta: 'Batch, streaming, and quality checks', reason: 'Recommended because pipeline tradeoffs reveal practical judgment.', route: '/coding-round' },
        { initials: 'DQ', title: 'Data Scenario Round', meta: 'Warehouse drift and recovery', reason: 'Recommended to practice handling imperfect production data.', route: '/scenario-round' },
        { initials: 'QB', title: 'Data Question Bank', meta: 'Data engineering prompts only', reason: 'Recommended to sharpen the areas you have not attempted yet.', route: '/question-bank?type=all' },
      ];
    case 'security':
      return [
        { initials: 'AT', title: 'Application Threat Review', meta: 'Auth, trust boundaries, and attack surfaces', reason: 'Recommended because threat modeling gives clear interview signal.', route: '/scenario-round' },
        { initials: 'SB', title: 'Secure Build Round', meta: 'Fix unsafe frontend and API behavior', reason: 'Recommended to turn security knowledge into implementation choices.', route: '/coding-round' },
        { initials: 'QB', title: 'Cybersecurity Question Bank', meta: 'Security-focused prompts for this track', reason: 'Recommended to keep coverage broad across security domains.', route: '/question-bank?type=all' },
      ];
    default:
      return [
        { initials: 'FE', title: 'Frontend Machine Coding', meta: 'State flow, async UI, and edge cases', reason: 'Recommended because machine coding is high leverage for frontend interviews.', route: '/coding-round' },
        { initials: 'RD', title: 'React Debugging Round', meta: 'Effects, stale state, and fixes', reason: 'Recommended to practice explaining fixes, not just naming concepts.', route: '/scenario-round' },
        { initials: 'QB', title: 'Frontend Question Bank', meta: 'Component and browser prompts only', reason: 'Recommended to keep topic coverage broad this week.', route: '/question-bank?type=all' },
      ];
  }
}

function insightFromAttempt(attempt: StoredRoundAttempt) {
  const missed = attempt.results.filter((result) => !result.isCorrect);
  const focus = missed[0]?.topic ?? attempt.focusAreas[0];
  if (!focus) return null;
  return {
    title: `${focus} needs the next focused drill.`,
    body: attempt.summary || `Latest ${attempt.roundType.replace('-', ' ')} score: ${attempt.score}%.`,
    timestamp: new Date(attempt.submittedAt ?? attempt.startedAt).toLocaleDateString(),
  };
}

function insightFromPracticeSession(session: PracticeSessionSummary) {
  const focus = session.weakTags[0];
  if (!focus || session.score === null) return null;
  return {
    title: `${focus} needs another practice pass.`,
    body: `${session.topic} finished at ${session.score}%. Saved practice sessions now feed your gap review and readiness score.`,
    timestamp: new Date(session.completedAt ?? session.generatedAt).toLocaleDateString(),
  };
}

function weightedAverage(scores: number[]) {
  const weights = [1, 0.86, 0.72, 0.58, 0.44];
  const slice = scores.slice(0, weights.length);
  const totalWeight = slice.reduce((sum, _score, index) => sum + weights[index], 0);
  if (!slice.length || !totalWeight) return null;
  const weighted = slice.reduce((sum, score, index) => sum + (score * weights[index]), 0);
  return Math.round(weighted / totalWeight);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const workspace = usePrepWorkspace();
  const [repoCount, setRepoCount] = useState(0);
  const [attempts, setAttempts] = useState<StoredRoundAttempt[]>([]);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSessionSummary[]>([]);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [activePracticeId, setActivePracticeId] = useState<string | null>(null);
  const [quickRoute, setQuickRoute] = useState('/scenario-round');
  const plan = workspace.prepPlan;
  const domain = workspace.selections.domain;
  const domainFamily = getDomainFamily(domain);
  const domainLabel = DOMAIN_LABELS[domain] ?? 'Frontend';
  const interviewTypeLabel = INTERVIEW_TYPE_LABELS[workspace.selections.interviewType] ?? 'Interview';
  const companyTypeLabel = COMPANY_TYPE_LABELS[workspace.selections.companyType] ?? 'Product Company';
  const timelineLabel = TIMELINE_LABELS[workspace.selections.timeline] ?? '1 week';
  const focusAreas = plan?.focusAreas?.slice(0, 3) ?? [];
  const recommendations = buildRecommendations(domainFamily);
  const currentDomainPracticeSessions = useMemo(
    () => practiceSessions.filter((session) => session.domain === domain && session.score !== null),
    [domain, practiceSessions],
  );
  const latestSignals = useMemo(() => ([
    ...attempts.map((attempt) => ({ score: attempt.score, timestamp: attempt.submittedAt ?? attempt.startedAt })),
    ...currentDomainPracticeSessions.map((session) => ({ score: session.score ?? 0, timestamp: session.completedAt ?? session.generatedAt })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())), [attempts, currentDomainPracticeSessions]);
  const latestScore = latestSignals[0]?.score;
  const prepScore = Math.min(96, Math.max(45, weightedAverage(latestSignals.map((signal) => signal.score)) ?? (latestScore ?? (plan ? 72 : 58))));
  const previousScore = latestSignals[1]?.score ?? Math.max(42, prepScore - 12);
  const scoreDelta = prepScore - previousScore;
  const sparkline = [prepScore - 10, prepScore - 8, prepScore - 6, prepScore - 5, prepScore - 3, previousScore, prepScore].map((score) => Math.min(96, Math.max(38, score)));
  const domainBreakdown = useMemo(() => {
    const aggregates = new Map<string, { total: number; count: number }>();
    for (const session of practiceSessions) {
      if (session.score === null) continue;
      const bucket = aggregates.get(session.domain) ?? { total: 0, count: 0 };
      bucket.total += session.score;
      bucket.count += 1;
      aggregates.set(session.domain, bucket);
    }
    const items = [...aggregates.entries()]
      .map(([domainId, aggregate]) => ({
        label: DOMAIN_LABELS[domainId] ?? domainId,
        value: Math.round(aggregate.total / Math.max(aggregate.count, 1)),
      }))
      .sort((left, right) => right.value - left.value);
    if (items.length) return items.slice(0, 4);

    const practiceAverage = currentDomainPracticeSessions.length
      ? Math.round(currentDomainPracticeSessions.reduce((sum, session) => sum + (session.score ?? 0), 0) / currentDomainPracticeSessions.length)
      : Math.max(42, prepScore - 10);
    const timedAverage = attempts.length
      ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length)
      : Math.max(40, prepScore - 14);

    return [
      { label: domainLabel, value: prepScore },
      { label: 'Practice Sessions', value: practiceAverage },
      { label: 'Timed Rounds', value: timedAverage },
    ];
  }, [attempts, currentDomainPracticeSessions, domainLabel, practiceSessions, prepScore]);
  const insights = useMemo(() => {
    const practiceInsights = currentDomainPracticeSessions.map(insightFromPracticeSession).filter(Boolean) as Array<{ title: string; body: string; timestamp: string }>;
    const roundInsights = attempts.map(insightFromAttempt).filter(Boolean) as Array<{ title: string; body: string; timestamp: string }>;
    return [...practiceInsights, ...roundInsights].slice(0, 4);
  }, [attempts, currentDomainPracticeSessions]);
  const gapTopics = useMemo(() => {
    const fromPracticeSessions = currentDomainPracticeSessions.flatMap((session) => session.weakTags);
    const fromAttempts = attempts.flatMap((attempt) => attempt.focusAreas);
    const fromResults = attempts.flatMap((attempt) => attempt.results.filter((result) => !result.isCorrect).map((result) => result.topic));
    return Array.from(new Set([...fromPracticeSessions, ...fromAttempts, ...fromResults])).slice(0, 4);
  }, [attempts, currentDomainPracticeSessions]);
  const hasAnyActivity = attempts.length || currentDomainPracticeSessions.length;

  useEffect(() => {
    let ignore = false;
    void listGithubRepos().then((data) => {
      if (ignore) return;
      setRepoCount(data.repos.length);
      data.pendingJobs.forEach((job) => {
        void getGithubScanJob(job.id).catch(() => null);
      });
    }).catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    try {
      setActivePracticeId(window.localStorage.getItem('repoid-active-practice-session'));
    } catch {
      setActivePracticeId(null);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void fetchLatestRoundAttemptSummary(domain).then((result) => {
      if (ignore) return;
      setAttempts(result.ok ? result.data.filter((attempt) => attempt.domain === domain) : []);
    }).catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [domain]);

  useEffect(() => {
    let ignore = false;
    void fetchPracticeSessions({ savedOnly: true }).then((result) => {
      if (ignore || result.ok === false) return;
      setPracticeSessions(result.data);
    }).catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  const startQuickRound = () => {
    setQuickStartOpen(false);
    navigate(quickRoute);
  };

  return (
    <div className="min-h-full bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <BackgroundRippleEffect rows={10} cols={28} cellSize={66} />
      </div>
      <main className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 pb-14 pt-6 sm:px-6 lg:px-10">
        <section className="border-b border-blueprint-line/80 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-display-xl text-primary">Dashboard</h1>
              <p className="mt-3 text-body-lg text-blueprint-muted">
                Your {domainLabel.toLowerCase()} {interviewTypeLabel.toLowerCase()} workspace for {companyTypeLabel.toLowerCase()} interviews over {timelineLabel.toLowerCase()}.
              </p>
            </div>
            <button type="button" onClick={() => setQuickStartOpen(true)} className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
              <Play size={15} /> Start Round
            </button>
          </div>
        </section>

        <button type="button" onClick={() => navigate('/github-repos')} className="surface-card text-left transition-colors hover:bg-white/85">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-3 text-ui-label text-blueprint-muted">
                <Github size={18} />
                GitHub Repo Scanner for Interviews
              </div>
              <h2 className="mt-3 text-headline-md text-primary not-italic">Generate repo-specific interview questions.</h2>
              <p className="mt-2 max-w-3xl text-body-md text-blueprint-muted">
                Open the scanner to analyze public repositories or connected private repositories.
              </p>
            </div>
            <span className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-ui-label text-white">
              Open Scanner <ArrowRight size={15} />
            </span>
          </div>
          <p className="mt-4 text-ui-label text-blueprint-muted">View {repoCount} scanned repos</p>
        </button>

        <section className="grid gap-5 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.15fr)]">
          <article className="surface-card min-h-0">
            <div className="flex items-start justify-between gap-4">
              <span className="text-ui-label text-blueprint-muted">Prep Readiness</span>
              <span className="rounded-full border border-blueprint-line bg-[#f5f3f3] px-3 py-1.5 text-ui-label text-primary">
                <Info size={13} className="mr-1 inline" /> Calculated
              </span>
            </div>
            <div className="mt-6 border-t border-blueprint-line pt-6">
              <p className="font-serif text-[clamp(4rem,10vw,96px)] leading-none text-primary">
                {prepScore}<span className="ml-1 text-headline-md text-blueprint-muted">%</span>
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 items-end gap-1" aria-label="Last 7 days readiness trend">
                  {sparkline.map((score, index) => (
                    <span key={`${score}-${index}`} className="w-2 rounded-full bg-primary/80" style={{ height: `${Math.max(10, score / 2.4)}px` }} />
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-blueprint-line bg-[#f5f3f3] px-3 py-1.5 text-ui-label text-primary">
                  <TrendingUp size={13} /> {scoreDelta >= 0 ? '+' : ''}{scoreDelta}% from last week
                </span>
              </div>
              <p className="mt-4 text-body-md text-blueprint-muted">
                {hasAnyActivity
                  ? `Calculated from your latest ${domainLabel.toLowerCase()} round scores, saved practice sessions, weak tags, and recent activity.`
                  : 'Start a timed round to replace this estimate with real attempt data.'}
              </p>
            </div>
          </article>

          <article id="gap-review" className="surface-card min-h-0">
            <div className="flex flex-col gap-2 border-b border-blueprint-line pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-ui-label text-blueprint-muted">Gap Review</p>
                <h2 className="mt-1 text-headline-md text-primary not-italic">Current weak areas</h2>
              </div>
              <button type="button" onClick={() => navigate('/practice-tracks')} className="w-fit rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
                Drill Gaps
              </button>
            </div>
            {gapTopics.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {gapTopics.map((topic, index) => (
                  <div key={topic} className="surface-inset">
                    <p className="text-ui-label text-blueprint-muted">Priority {index + 1}</p>
                    <p className="mt-1 text-body-md font-medium text-primary">{topic}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-blueprint-line bg-[#fbf9f9] p-5">
                <p className="text-body-md font-medium text-primary">Complete your first round to see your weak areas.</p>
                <p className="mt-2 text-body-md text-blueprint-muted">Gap review starts tracking missed topics after one submitted round.</p>
                <button type="button" onClick={() => navigate('/scenario-round')} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">
                  <Play size={14} /> Start a Round
                </button>
              </div>
            )}
          </article>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <article className="surface-card">
            <p className="text-ui-label text-blueprint-muted">Daily Goal</p>
            <div className="mt-4 flex items-start gap-3">
              <CheckCircle2 size={24} className={hasAnyActivity ? 'text-emerald-600' : 'text-blueprint-muted'} />
              <div>
                <p className="text-body-md font-medium text-primary">Today's goal: complete 1 session</p>
                <p className="mt-1 text-body-md text-blueprint-muted">{hasAnyActivity ? 'Goal filled by your latest round or saved practice session.' : 'One saved practice session or timed round will complete this for today.'}</p>
              </div>
            </div>
          </article>
          <article className="surface-card">
            <p className="text-ui-label text-blueprint-muted">Consistency</p>
            <p className="mt-4 text-headline-md text-primary not-italic">{hasAnyActivity ? '1-day streak' : '0-day streak'}</p>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {sparkline.map((score, index) => (
                <span key={index} className={`h-7 rounded border border-blueprint-line ${index >= 5 && hasAnyActivity ? 'bg-primary' : score > 60 ? 'bg-[#d8d2d2]' : 'bg-[#f5f3f3]'}`} />
              ))}
            </div>
          </article>
          <article className="surface-card">
            <p className="text-ui-label text-blueprint-muted">Mock Interview</p>
            <div className="mt-4 flex gap-3">
              <CalendarDays size={22} className="text-blueprint-muted" />
              <p className="text-body-md text-primary">Add your interview date later; for now, focus on one scenario and one review round this week.</p>
            </div>
          </article>
        </section>

        <section className="surface-card">
          <div className="border-b border-blueprint-line pb-4">
            <p className="text-ui-label text-blueprint-muted">Readiness Breakdown</p>
            <h2 className="mt-1 text-headline-md text-primary not-italic">Where to focus next</h2>
          </div>
          <div className="mt-5 grid gap-4">
            {domainBreakdown.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-body-md">
                  <span className="font-medium text-primary">{item.label}</span>
                  <span className="text-blueprint-muted">{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#e4e2e2]">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {insights.length || focusAreas.length ? (
          <section className="surface-card">
            <div className="border-b border-blueprint-line pb-4">
              <p className="text-ui-label text-blueprint-muted">Prep Insights</p>
              <h2 className="mt-1 text-headline-md text-primary not-italic">What changed from your data</h2>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {insights.map((signal) => (
                <div key={`${signal.title}-${signal.timestamp}`} className="surface-inset">
                  <p className="text-body-md font-medium text-primary">{signal.title}</p>
                  <p className="mt-2 text-body-md text-blueprint-muted">{signal.body}</p>
                  <span className="mt-3 inline-block rounded border border-blueprint-line bg-[#f5f3f3] px-2 py-1 text-ui-label text-blueprint-muted">
                    {signal.timestamp}
                  </span>
                </div>
              ))}
              {!insights.length && focusAreas.map((focus) => (
                <div key={focus} className="surface-inset">
                  <p className="text-body-md font-medium text-primary">{focus}</p>
                  <p className="mt-2 text-body-md text-blueprint-muted">Generated from your saved prep plan.</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="surface-card">
          <div className="mb-5 flex items-end justify-between border-b border-blueprint-line pb-4">
            <div>
              <p className="text-ui-label text-blueprint-muted">Recommendations</p>
              <h2 className="mt-1 text-headline-md text-primary not-italic">Next best modules</h2>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {recommendations.map((item) => (
              <button key={item.title} type="button" onClick={() => navigate(item.route)} className="flex items-center gap-4 rounded-xl border border-blueprint-line bg-[#fbf9f9] p-4 text-left transition-colors hover:bg-white">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#efeded] text-ui-label text-primary">
                  {item.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-body-md font-medium text-primary">{item.title}</p>
                  <p className="mt-1 text-body-md text-blueprint-muted">{item.meta}</p>
                  <p className="mt-2 text-sm leading-5 text-blueprint-muted">{item.reason}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card" id="dashboard-pricing">
          <div className="flex flex-col gap-4 border-b border-blueprint-line pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-ui-label text-blueprint-muted">Pricing</p>
              <h2 className="mt-1 text-headline-md text-primary not-italic">Plans for every prep window</h2>
            </div>
            <button type="button" onClick={() => navigate('/pricing')} className="w-fit rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">
              Open Billing
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ['Free', '₹0', 'Start with daily question-bank practice and one repo scan.'],
              ['Monthly', '₹29/mo', 'Unlock serious prep for short interview sprints.'],
              ['Long-Term', '₹149 / 6 months or ₹299 / year', 'Keep access through placement season and repeated rounds.'],
            ].map(([name, price, body]) => (
              <button key={name} type="button" onClick={() => navigate('/pricing')} className="rounded-xl border border-blueprint-line bg-[#fbf9f9] p-4 text-left transition-colors hover:bg-white">
                <p className="text-ui-label text-blueprint-muted">{name}</p>
                <p className="mt-2 text-headline-md text-primary not-italic">{price}</p>
                <p className="mt-2 text-body-md text-blueprint-muted">{body}</p>
              </button>
            ))}
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-4 border-t border-blueprint-line py-6 text-sm text-blueprint-muted sm:flex-row">
          <div className="flex flex-wrap justify-center gap-4">
            <button type="button" onClick={() => navigate('/privacy')} className="hover:text-primary">Privacy Policy</button>
            <button type="button" onClick={() => navigate('/terms')} className="hover:text-primary">Terms</button>
            <button type="button" onClick={() => navigate('/contact')} className="hover:text-primary">Contact Us</button>
          </div>
          <p className="flex items-center gap-2">
            2026 Repoid. All rights reserved. Made by Satwik
            <Heart size={14} className="fill-[#6b4a2f] text-[#6b4a2f] dark:fill-white dark:text-white" />
          </p>
        </footer>
      </main>

      {quickStartOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-blueprint-line bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-ui-label text-blueprint-muted">Quick Start</p>
                <h2 className="mt-2 text-headline-md text-primary not-italic">Pick a round type</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setQuickStartOpen(false)} className="text-blueprint-muted hover:text-primary"><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-2">
              {[
                ['/scenario-round', 'Scenario Round'],
                ['/coding-round', 'Coding Round'],
                ['/mock-interview', 'Mock Interview'],
                ['/practice-tracks', 'Practice Session'],
              ].map(([route, label]) => (
                <button key={route} type="button" onClick={() => setQuickRoute(route)} className={`rounded-xl border px-4 py-3 text-left text-body-md ${quickRoute === route ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-[#fbf9f9] text-primary'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={startQuickRound} className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-ui-label text-white">Start</button>
          </div>
        </div>
      ) : null}

      {activePracticeId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-blueprint-line bg-card p-6 text-center shadow-2xl">
            <p className="text-ui-label text-blueprint-muted">Practice In Progress</p>
            <h2 className="mt-2 text-headline-md text-primary not-italic">Resume your active session?</h2>
            <p className="mt-3 text-body-md text-blueprint-muted">Your timer kept running and your saved answers will load from the same question.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button type="button" onClick={() => setActivePracticeId(null)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary">
                Later
              </button>
              <button type="button" onClick={() => navigate(`/round/practice/${activePracticeId}`)} className="rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">
                Resume Session
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
