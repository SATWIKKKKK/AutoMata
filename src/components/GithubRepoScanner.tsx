import React, { useEffect, useMemo, useState } from 'react';
import { Github, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GITHUB_SCAN_LINES, isValidGithubRepoUrl, scanGithubRepo } from '../lib/githubRepos';

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
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisibleCount((count) => Math.min(GITHUB_SCAN_LINES.length, count + 1));
    }, 560);
    const minimumTimer = window.setTimeout(() => setMinElapsed(true), 5600);
    let ignore = false;
    void scanGithubRepo(repoUrl, force).then((scanResult) => {
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
      }
      setResult({ status: scanResult.status, message: scanResult.message });
    });

    return () => {
      ignore = true;
      window.clearInterval(interval);
      window.clearTimeout(minimumTimer);
    };
  }, [force, repoUrl]);

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
  const errorMessage = result?.status && result.status !== 'complete' ? result.message : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#101111] px-4 text-white">
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:text-white">
          <X size={18} />
        </button>
      ) : null}
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-3 text-white/60">
          <Github size={18} />
          <span className="text-ui-label">GitHub repo scanner</span>
        </div>
        <div className="min-h-[360px] rounded-lg border border-white/10 bg-black/35 p-5 font-mono text-sm leading-7 shadow-2xl sm:p-8">
          {lines.map((line, index) => (
            <p key={line} className={index === lines.length - 1 ? 'text-white' : 'text-white/55'}>
              <span className="text-emerald-300">$</span> {line}
            </p>
          ))}
          {errorMessage ? (
            <div className="mt-8 border-t border-white/10 pt-6 font-sans">
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
        </div>
      </div>
    </div>
  );
}
