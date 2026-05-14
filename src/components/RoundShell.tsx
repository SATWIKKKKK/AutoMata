import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { abandonRound, logFocusEvent } from '../lib/roundRuntime';

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

class RoundErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-blueprint-line bg-card p-6 text-center shadow-xl">
            <p className="text-ui-label text-blueprint-muted">Progress Saved</p>
            <h2 className="mt-2 text-headline-md text-primary not-italic">Something went wrong in this round.</h2>
            <p className="mt-3 text-body-md text-blueprint-muted">Your attempt is still open. Retry the current screen to continue from the saved state.</p>
            <button type="button" onClick={() => this.setState({ hasError: false })} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">
              Retry Current Question
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RoundShell({
  attemptId,
  feature,
  label,
  startedAt,
  pausedMs = 0,
  counter,
  onEndEarly,
  children,
}: {
  attemptId?: string | null;
  feature: string;
  label: string;
  startedAt?: string | null;
  pausedMs?: number;
  counter?: string;
  onEndEarly?: () => void;
  children: React.ReactNode;
}) {
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const pauseStartedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(pausedMs);
  const [visibilityWarning, setVisibilityWarning] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [endConfirm, setEndConfirm] = useState(false);
  const isMobile = useMemo(() => typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent), []);
  const startedAtMs = startedAt ? new Date(startedAt).getTime() : Date.now();

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (timerRef.current) timerRef.current.textContent = formatElapsed(Date.now() - startedAtMs - pausedMsRef.current);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [startedAtMs]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!attemptId) return;
      if (document.hidden) {
        void logFocusEvent(attemptId, feature, 'visibility-hidden');
      } else {
        setVisibilityWarning(true);
        void logFocusEvent(attemptId, feature, 'visibility-returned');
      }
    };
    const handleFullscreen = () => {
      if (!attemptId) return;
      if (!document.fullscreenElement) {
        pauseStartedAtRef.current = Date.now();
        setFullscreenWarning(true);
        void logFocusEvent(attemptId, feature, 'fullscreen-exit');
      }
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (attemptId) void abandonRound(attemptId, feature, 'beforeunload');
      event.preventDefault();
      event.returnValue = '';
    };
    const handleKeydown = (event: KeyboardEvent) => {
      const isExitShortcut = (event.altKey && event.key === 'ArrowLeft')
        || ((event.ctrlKey || event.metaKey) && ['w', 'r'].includes(event.key.toLowerCase()));
      if (isExitShortcut) {
        event.preventDefault();
        setEndConfirm(true);
      }
      if (event.key === 'Escape') setEndConfirm(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [attemptId, feature]);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const resumeFullscreen = async () => {
    if (pauseStartedAtRef.current) {
      pausedMsRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    setFullscreenWarning(false);
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-blueprint-line bg-card/95 px-4 py-3 backdrop-blur">
        {isMobile ? <p className="mb-2 rounded-lg border border-blueprint-line bg-[#fff7df] px-3 py-2 text-ui-label text-primary">Round in progress - navigating away will end your session.</p> : null}
        <div className="mx-auto flex max-w-360 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ui-label text-blueprint-muted">{label}</p>
            {counter ? <p className="text-body-md text-primary">{counter}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <span ref={timerRef} className="rounded-full border border-blueprint-line px-3 py-1.5 text-ui-label text-primary">0:00</span>
            <button type="button" onClick={() => setEndConfirm(true)} className="rounded-full border border-blueprint-line px-4 py-2 text-ui-label text-primary">End Early</button>
          </div>
        </div>
      </div>

      {offline ? <div className="fixed left-1/2 top-20 z-[90] -translate-x-1/2 rounded-full border border-blueprint-line bg-card px-5 py-3 text-ui-label text-primary shadow-xl">Connection lost - your answer is saved locally.</div> : null}
      {visibilityWarning ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4"><div className="max-w-md rounded-2xl bg-card p-6 text-center"><h2 className="text-headline-md text-primary not-italic">You left the round.</h2><p className="mt-2 text-body-md text-blueprint-muted">The timer continued running and your progress is intact.</p><button type="button" onClick={() => setVisibilityWarning(false)} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">Resume</button></div></div> : null}
      {fullscreenWarning ? <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4"><div className="max-w-md rounded-2xl bg-card p-6 text-center"><h2 className="text-headline-md text-primary not-italic">Return to fullscreen.</h2><p className="mt-2 text-body-md text-blueprint-muted">The round is paused while this overlay is active.</p><button type="button" onClick={() => { void resumeFullscreen(); }} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">Re-enter Fullscreen</button></div></div> : null}
      {endConfirm ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"><div className="max-w-md rounded-2xl bg-card p-6"><p className="text-ui-label text-blueprint-muted">End Round Early</p><h2 className="mt-2 text-headline-md text-primary not-italic">Submit your current progress?</h2><p className="mt-2 text-body-md text-blueprint-muted">Your saved answers will be submitted and scored where possible.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEndConfirm(false)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary">Stay</button><button type="button" onClick={onEndEarly} className="rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">End Round</button></div></div></div> : null}

      <RoundErrorBoundary>{children}</RoundErrorBoundary>
    </div>
  );
}
