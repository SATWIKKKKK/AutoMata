import React, { useEffect, useMemo, useState } from 'react';
import { Github, Loader2, Radar, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GITHUB_SCAN_LINES, getGithubScanJob, scanGithubRepo } from '../lib/githubRepos';

type ScannerProps = {
  repoUrl: string;
  force?: boolean;
  onClose?: () => void;
  onError?: (message: string) => void;
  onComplete?: () => void;
};

export function GithubScanOverlay({ repoUrl, force = false, onClose, onError, onComplete }: ScannerProps) {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(1);
  const [result, setResult] = useState<{ repoId?: string; message?: string; status?: string } | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [takingLonger, setTakingLonger] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [restartCount, setRestartCount] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisibleCount((count) => Math.min(GITHUB_SCAN_LINES.length, count + 1));
    }, 800);
    const minimumTimer = window.setTimeout(() => setMinElapsed(true), GITHUB_SCAN_LINES.length * 800);
    const longerTimer = window.setTimeout(() => setTakingLonger(true), 15000);
    let ignore = false;
    void scanGithubRepo(repoUrl, force || restartCount > 0).then((scanResult) => {
      if (ignore) return;
      if (scanResult.status === 'complete') {
        setResult({ status: 'complete', repoId: scanResult.repoId });
        return;
      }
      if (scanResult.status === 'duplicate') {
        setResult({ status: 'complete', repoId: scanResult.repoId });
        return;
      }
      if (scanResult.status === 'private') {
        setVisibleCount(2);
      }
      if (scanResult.status === 'pending') {
        setVisibleCount(GITHUB_SCAN_LINES.length);
        setTakingLonger(true);
        if (scanResult.jobId) setPendingJobId(scanResult.jobId);
      }
      setResult({ status: scanResult.status, message: scanResult.message });
    }).catch((error) => {
      if (!ignore) setResult({ status: 'failed', message: error instanceof Error ? error.message : 'Unable to scan this repository.' });
    });

    return () => {
      ignore = true;
      window.clearInterval(interval);
      window.clearTimeout(minimumTimer);
      window.clearTimeout(longerTimer);
    };
  }, [force, repoUrl, restartCount]);

  useEffect(() => {
    if (!pendingJobId) return;
    let ignore = false;
    const poll = async () => {
      try {
        const job = await getGithubScanJob(pendingJobId);
        if (ignore) return;
        if (job.status === 'complete' && job.repoId) {
          setResult({ status: 'complete', repoId: job.repoId });
          return;
        }
        if (job.status === 'failed') {
          const status = job.message?.startsWith('This repository is private') ? 'private' : 'failed';
          setResult({ status, message: job.message ?? 'We had trouble analyzing this repository. Please try again.' });
        }
      } catch {
        if (!ignore) setResult({ status: 'failed', message: 'Unable to check this repository scan.' });
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 5000);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [pendingJobId]);

  useEffect(() => {
    if (result?.status === 'complete' && result.repoId && minElapsed) {
      onComplete?.();
      navigate(`/github-project-qs/${result.repoId}`);
    }
  }, [minElapsed, navigate, onComplete, result]);

  const lines = useMemo(
    () => GITHUB_SCAN_LINES.slice(0, result?.status === 'private' ? 2 : visibleCount),
    [result?.status, visibleCount],
  );
  const errorMessage = result?.status && !['complete', 'pending'].includes(result.status) ? result.message : null;
  const infoMessage = result?.status === 'pending' || takingLonger
    ? (result?.message || 'This is taking longer than usual. Keeping this scan live until your questions are ready.')
    : null;
  const canForceRestart = result?.status === 'pending' && !force && restartCount === 0;
  const progress = Math.round((Math.min(visibleCount, GITHUB_SCAN_LINES.length) / GITHUB_SCAN_LINES.length) * 100);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[#070909] px-4 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:text-white">
          <X size={18} />
        </button>
      ) : null}
      <div className="relative w-full max-w-5xl">
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3 text-white/60">
              <Github size={18} />
              <span className="text-ui-label uppercase">GitHub repo scanner</span>
            </div>
            <h1 className="mt-3 text-headline-lg text-white">Building your project question set</h1>
            <p className="mt-2 max-w-2xl text-body-md text-white/55">
              Keep this tab open. You will be redirected automatically as soon as the repo-specific questions and answers are ready.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-ui-label text-white/70">
            <Loader2 size={16} className="animate-spin text-emerald-300" />
            Live scan
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-h-[420px] rounded-xl border border-white/10 bg-black/50 p-5 font-mono text-sm leading-7 shadow-2xl sm:p-8">
            <div className="mb-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-300 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            {lines.map((line, index) => (
              <p key={line} className={index === lines.length - 1 ? 'text-white' : 'text-white/55'}>
                <span className="text-emerald-300">$</span> {line}
              </p>
            ))}
            {!errorMessage && result?.status !== 'complete' ? (
              <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6 font-sans text-body-md text-white/70">
                <Loader2 size={18} className="animate-spin text-emerald-300" />
                Generating answers, code snippets, domain labels, and deep-dive sections...
              </div>
            ) : null}
          </div>

          <aside className="rounded-xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="relative mx-auto mb-6 flex h-36 w-36 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-emerald-300/20" />
              <div className="absolute inset-3 animate-spin rounded-full border border-transparent border-t-emerald-300" />
              <div className="absolute inset-8 animate-pulse rounded-full bg-emerald-300/10" />
              <Radar size={42} className="text-emerald-300" />
            </div>
            <div className="space-y-3">
              {GITHUB_SCAN_LINES.slice(0, 6).map((line, index) => {
                const active = index < visibleCount;
                return (
                  <div key={line} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${active ? 'border-emerald-300/20 bg-emerald-300/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/35'}`}>
                    <Sparkles size={14} className={active ? 'text-emerald-300' : 'text-white/25'} />
                    <span>{line.replace('...', '')}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-5">
          {errorMessage ? (
            <div className="font-sans">
              <p className="text-body-lg text-white">{errorMessage}</p>
              {result?.status === 'private' ? (
                <button type="button" onClick={() => window.location.assign('/api/auth/oauth/github')} className="mt-5 rounded-full bg-white px-5 py-3 text-ui-label text-primary transition-colors hover:bg-white/90">
                  Connect GitHub
                </button>
              ) : (
                <button type="button" onClick={() => { onError?.(errorMessage); onClose?.(); }} className="mt-5 rounded-full bg-white px-5 py-3 text-ui-label text-primary transition-colors hover:bg-white/90">
                  Close
                </button>
              )}
            </div>
          ) : null}
          {!errorMessage && infoMessage ? (
            <div className="font-sans">
              <p className="text-body-lg text-white">{infoMessage}</p>
              <p className="mt-2 text-body-md text-white/55">Still working. This screen will automatically open the questions page when the scan completes.</p>
              {canForceRestart ? (
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setPendingJobId(null);
                    setTakingLonger(false);
                    setVisibleCount(1);
                    setRestartCount((count) => count + 1);
                  }}
                  className="mt-5 rounded-full bg-white px-5 py-3 text-ui-label text-primary transition-colors hover:bg-white/90"
                >
                  Force new scan
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
