import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function RoundGuard({
  roundName,
  durationMinutes,
  resultsPath,
  onExpire,
  onStart,
  children,
}: {
  roundName: string;
  durationMinutes: number;
  resultsPath: string;
  onExpire?: () => void | Promise<void>;
  onStart?: () => void | Promise<void>;
  children?: (state: {
    started: boolean;
    expired: boolean;
    secondsLeft: number;
    formattedTime: string;
    inputsLocked: boolean;
  }) => React.ReactNode;
}) {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [expired, setExpired] = useState(false);
  const [showStartedNotice, setShowStartedNotice] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const expireHandledRef = useRef(false);

  const rules = useMemo(() => [
    'Do not refresh or leave the round once started.',
    'When the timer ends, inputs lock and the round is submitted automatically.',
    'Open another practice section only after this round is finished.',
  ], []);

  useEffect(() => {
    if (!started || expired) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expired, started]);

  useEffect(() => {
    if (!started || secondsLeft > 0 || expired) return;
    setExpired(true);
  }, [expired, secondsLeft, started]);

  useEffect(() => {
    if (!expired || expireHandledRef.current) return undefined;
    expireHandledRef.current = true;
    let cancelled = false;
    const handleExpire = async () => {
      await Promise.resolve(onExpire?.());
      if (cancelled) return;
      const timeout = window.setTimeout(() => {
        navigate(resultsPath);
      }, 1800);
      return () => window.clearTimeout(timeout);
    };
    void handleExpire();
    return () => {
      cancelled = true;
    };
  }, [expired, navigate, onExpire, resultsPath]);

  useEffect(() => {
    if (!showStartedNotice) return undefined;
    const timeout = window.setTimeout(() => setShowStartedNotice(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [showStartedNotice]);

  return (
    <>
      {children?.({
        started,
        expired,
        secondsLeft,
        formattedTime: formatTime(secondsLeft),
        inputsLocked: !started || expired,
      })}

      <div className="fixed right-4 top-20 z-40 rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        {formatTime(secondsLeft)}
      </div>

      {!started ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-blueprint-line bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <p className="text-ui-label text-blueprint-muted">Before You Start</p>
            <h2 className="mt-3 text-headline-lg text-primary">{roundName}</h2>
            <div className="mt-6 space-y-3">
              {rules.map((rule) => (
                <div key={rule} className="flex gap-3 rounded-lg border border-blueprint-line bg-[#fbf9f9] p-3 text-body-md text-primary">
                  <span className="material-symbols-outlined text-[18px]">rule</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  setStartPending(true);
                  setStartError(null);
                  await Promise.resolve(onStart?.());
                  setStarted(true);
                  setShowStartedNotice(true);
                } catch (error) {
                  setStartError(error instanceof Error ? error.message : 'Unable to start the round.');
                } finally {
                  setStartPending(false);
                }
              }}
              disabled={startPending}
              className="mt-8 w-full rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startPending ? 'Starting…' : 'Start Timed Round'}
            </button>
            {startError ? <p className="mt-3 text-sm text-red-600">{startError}</p> : null}
          </div>
        </div>
      ) : null}

      {showStartedNotice ? (
        <div className="fixed left-1/2 top-20 z-[65] -translate-x-1/2 rounded-full border border-blueprint-line bg-white px-5 py-3 text-ui-label text-primary shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          Round started. Your timer is now active.
        </div>
      ) : null}

      {expired ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-white/80 px-4 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl border border-blueprint-line bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.14)]">
            <p className="text-ui-label text-blueprint-muted">Time Is Up</p>
            <h2 className="mt-3 text-headline-lg text-primary">The prep is over.</h2>
            <p className="mt-3 text-body-md text-blueprint-muted">
              Your answers are locked. We are sending you to the results page now.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
