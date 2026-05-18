import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { Bookmark, BookmarkCheck, ChevronDown, ChevronLeft, ChevronRight, History, LoaderCircle, NotebookPen, Play, Shuffle, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import RoundShell from '../components/RoundShell';
import RoundDomainGate from '../components/RoundDomainGate';
import { DOMAIN_FAMILIES, DOMAIN_LABELS } from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';
import {
  fetchCodingAttempt,
  fetchCodingHistory,
  fetchCodingOverview,
  fetchCodingStarterCode,
  generateCodingAttempt,
  saveCodingAttempt,
  submitCodingAttempt,
  type CodingAttempt,
  type CodingDifficulty,
  type CodingLanguage,
} from '../lib/codingRound';
import { executeCodingSnippet, type CodingExecutionResult } from '../lib/codingExecution';
import { fetchServerDraft, readLocalDraft, saveLocalDraft, saveServerDraft, shouldPromptForLocalDraft } from '../lib/roundRuntime';

const LazyCodeEditor = React.lazy(() => import('../components/LazyCodeEditor'));
const CODING_GENERATION_ESTIMATED_TOTAL_SECONDS = 15;

const LANGUAGE_LABELS: Record<CodingLanguage, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  sql: 'SQL',
  bash: 'Bash',
};

const DOMAIN_LANGUAGE_OPTIONS: Record<string, CodingLanguage[]> = {
  frontend: ['typescript', 'javascript'],
  backend: ['typescript', 'javascript', 'python'],
  'backend-python': ['python', 'typescript', 'javascript'],
  'full-stack': ['typescript', 'javascript'],
  cybersecurity: ['python', 'typescript', 'bash'],
  security: ['python', 'typescript', 'bash'],
  'data-science': ['python'],
  'data-analytics': ['sql', 'python'],
  'sql-databases': ['sql', 'python'],
  'ai-ml': ['python', 'typescript'],
  react: ['typescript', 'javascript'],
  'next-js': ['typescript', 'javascript'],
  typescript: ['typescript', 'javascript'],
  'backend-nodejs': ['typescript', 'javascript', 'python'],
};

type LanguageOption = {
  value: CodingLanguage;
  label: string;
};

type CodingDraftPayload = {
  code?: string;
  notes?: string;
  language?: string;
  savedAt?: string;
};

type RunPanelOutput = CodingExecutionResult;

function difficultyCardClasses(level: CodingDifficulty, selected: boolean) {
  if (level === 'easy') {
    return selected
      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
      : 'border-emerald-500/40 bg-[#161616] text-[#d7efe0]';
  }
  if (level === 'hard') {
    return selected
      ? 'border-red-400 bg-red-500/15 text-red-100'
      : 'border-red-500/40 bg-[#161616] text-[#f1d4d4]';
  }
  return selected
    ? 'border-amber-300 bg-amber-500/15 text-amber-50'
    : 'border-amber-500/40 bg-[#161616] text-[#f1e2c8]';
}

function difficultyBadgeClasses(level: CodingDifficulty) {
  if (level === 'easy') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (level === 'hard') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-300';
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-300';
}

function formatLanguageLabel(language: string) {
  if (language === 'bash') return 'Bash';
  if (language === 'javascript') return 'JavaScript';
  if (language === 'sql') return 'SQL';
  if (language === 'python') return 'Python';
  return 'TypeScript';
}

function normalizeClientCodingLanguage(value: unknown, fallback: CodingLanguage): CodingLanguage {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'javascript' || normalized === 'js') return 'javascript';
  if (normalized === 'python') return 'python';
  if (normalized === 'sql') return 'sql';
  if (normalized === 'bash' || normalized === 'shell' || normalized === 'sh') return 'bash';
  if (normalized === 'typescript' || normalized === 'ts') return 'typescript';
  return fallback;
}

function resolveLanguageDomainKey(domain: string) {
  if (DOMAIN_LANGUAGE_OPTIONS[domain]) return domain;
  const family = DOMAIN_FAMILIES[domain];
  if (family === 'frontend') return 'frontend';
  if (family === 'backend') return domain === 'backend-python' ? 'backend-python' : 'backend';
  if (family === 'full-stack') return 'full-stack';
  if (family === 'security') return 'cybersecurity';
  if (family === 'ai-ml') return 'ai-ml';
  if (domain === 'sql-databases') return 'data-analytics';
  if (family === 'data') return 'data-science';
  return 'frontend';
}

function getDomainLanguageOptions(domain: string): LanguageOption[] {
  const values = DOMAIN_LANGUAGE_OPTIONS[resolveLanguageDomainKey(domain)] ?? DOMAIN_LANGUAGE_OPTIONS.frontend;
  return values.map((value) => ({ value, label: LANGUAGE_LABELS[value] }));
}

function getPrimaryCodingLanguage(domain: string): CodingLanguage {
  return getDomainLanguageOptions(domain)[0]?.value ?? 'typescript';
}

function formatAttemptDate(value: string | null | undefined) {
  if (!value) return 'Not saved';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Saved recently';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function codingScoreLabel(attempt: CodingAttempt) {
  if (attempt.score === null) {
    if (attempt.status === 'submitted') return 'Submitted';
    return 'In progress';
  }
  return `${attempt.score}/10`;
}

function codingStatusLabel(attempt: CodingAttempt) {
  if (attempt.status === 'submitted') return 'completed';
  return 'in-progress';
}

export default function CodingRoundPage() {
  const navigate = useNavigate();
  const params = useParams<{ attemptId?: string }>();
  const workspace = usePrepWorkspace();
  const attemptId = String(params.attemptId ?? '').trim();
  const domain = workspace.selections.domain;
  const domainLabel = DOMAIN_LABELS[domain] ?? 'Selected Domain';

  const [selectedDifficulty, setSelectedDifficulty] = useState<CodingDifficulty | null>(null);
  const [domainConfirmed, setDomainConfirmed] = useState(Boolean(attemptId));
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [checkingOverview, setCheckingOverview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<CodingAttempt | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<CodingAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySaveId, setHistorySaveId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<CodingLanguage>(getPrimaryCodingLanguage(domain));
  const [code, setCode] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSurfaceOpen, setNotesSurfaceOpen] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [starterLoading, setStarterLoading] = useState(false);
  const [starterError, setStarterError] = useState<string | null>(null);
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const [runningCode, setRunningCode] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState<RunPanelOutput>({ stdout: [], stderr: [], notices: [] });
  const [clockNow, setClockNow] = useState(Date.now());
  const [expiring, setExpiring] = useState(false);
  const [launchFlowStarted, setLaunchFlowStarted] = useState(Boolean(attemptId));
  const [navigationState, setNavigationState] = useState<'previous' | 'next' | null>(null);

  const generationStartedAtRef = useRef<number | null>(null);
  const generationPhaseRef = useRef<HTMLParagraphElement | null>(null);
  const elapsedRef = useRef<HTMLSpanElement | null>(null);
  const remainingRef = useRef<HTMLSpanElement | null>(null);
  const autoSubmitHandledRef = useRef(false);
  const codeRef = useRef('');
  const editorViewRef = useRef<EditorView | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const elapsedSeconds = attempt
    ? Math.max(0, Math.floor((clockNow - new Date(attempt.startedAt).getTime()) / 1000))
    : 0;
  const roundExpired = Boolean(attempt && elapsedSeconds >= attempt.durationMinutes * 60);
  const languageOptions = useMemo(() => getDomainLanguageOptions(attempt?.problem.domain ?? domain), [attempt?.problem.domain, domain]);

  const startCodingRound = useCallback(async () => {
    if (!selectedDifficulty || generating) return;
    setGenerating(true);
    setError(null);
    const result = await generateCodingAttempt({ domain, difficulty: selectedDifficulty, forceNew: Boolean(activeAttemptId) });
    setGenerating(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    navigate(`/round/coding/${encodeURIComponent(result.data.id)}`, { replace: true });
  }, [activeAttemptId, domain, generating, navigate, selectedDifficulty]);

  const handleSaveAttempt = useCallback(async () => {
    if (!attempt || savingAttempt) return;
    setSavingAttempt(true);
    const result = await saveCodingAttempt(attempt.id, { saved: true });
    setSavingAttempt(false);
    if (result.ok === true) {
      setSavedAt(result.data.savedAt);
      setHistoryItems((current) => current.map((item) => item.id === attempt.id ? { ...item, savedAt: result.data.savedAt } : item));
      return;
    }
    setError(result.error);
  }, [attempt, savingAttempt]);

  const openNotesSurface = useCallback(() => {
    setNotesDraft(savedNotes);
    setNotesSurfaceOpen(true);
    window.requestAnimationFrame(() => {
      notesTextareaRef.current?.focus();
      notesTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [savedNotes]);

  const closeNotesSurface = useCallback(() => {
    setNotesDraft(savedNotes);
    setNotesSurfaceOpen(false);
  }, [savedNotes]);

  const handleSaveNotes = useCallback(async () => {
    if (!attempt || savingNotes) return;
    const nextNotes = notesDraft;
    setSavingNotes(true);
    saveLocalDraft('coding-round', attempt.id, {
      code: codeRef.current,
      notes: nextNotes,
      language: selectedLanguage,
      savedAt: new Date().toISOString(),
    });
    const result = await saveServerDraft('coding-round', attempt.id, {
      code: codeRef.current,
      notes: nextNotes,
      language: selectedLanguage,
      savedAt: new Date().toISOString(),
    });
    setSavingNotes(false);
    setSavedNotes(nextNotes);
    setNotesSurfaceOpen(false);
    if (result.ok === false) {
      setError(result.error);
    }
  }, [attempt, notesDraft, savingNotes, selectedLanguage]);

  const handleHistorySave = useCallback(async (historyAttempt: CodingAttempt) => {
    if (historySaveId === historyAttempt.id) return;
    setHistorySaveId(historyAttempt.id);
    const result = await saveCodingAttempt(historyAttempt.id, { saved: true });
    setHistorySaveId(null);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setHistoryItems((current) => current.map((item) => item.id === historyAttempt.id ? { ...item, savedAt: result.data.savedAt } : item));
    if (attempt?.id === historyAttempt.id) {
      setSavedAt(result.data.savedAt);
    }
  }, [attempt?.id, historySaveId]);

  const openHistoryAttempt = useCallback((historyAttempt: CodingAttempt) => {
    if (historyAttempt.status === 'submitted') {
      navigate(`/results/coding/${encodeURIComponent(historyAttempt.id)}`);
      return;
    }
    navigate(`/round/coding/${encodeURIComponent(historyAttempt.id)}`);
  }, [navigate]);

  const replaceEditorCode = useCallback((nextCode: string) => {
    const editor = editorViewRef.current;
    if (editor) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: nextCode } });
    }
    codeRef.current = nextCode;
    setCode(nextCode);
  }, []);

  const handleLanguageChange = useCallback(async (nextLanguage: CodingLanguage) => {
    if (!attempt || starterLoading || nextLanguage === selectedLanguage) {
      setSelectedLanguage(nextLanguage);
      return;
    }
    setStarterLoading(true);
    setStarterError(null);
    setSelectedLanguage(nextLanguage);
    const result = await fetchCodingStarterCode(attempt.problem.id, { language: nextLanguage, domain: attempt.problem.domain });
    setStarterLoading(false);
    if (result.ok === false) {
      setStarterError(result.error);
      return;
    }
    replaceEditorCode(result.data);
    saveLocalDraft('coding-round', attempt.id, { code: result.data, notes: savedNotes, language: nextLanguage, savedAt: new Date().toISOString() });
  }, [attempt, replaceEditorCode, savedNotes, selectedLanguage, starterLoading]);

  const handlePreviousProblem = useCallback(async () => {
    if (!attempt) return;
    setNavigationState('previous');
    const history = await fetchCodingHistory(attempt.problem.domain, attempt.problem.difficulty);
    if (history.ok === false) {
      setNavigationState(null);
      setError(history.error);
      return;
    }
    const previous = history.data.find((item) => item.id !== attempt.id);
    if (previous) {
      navigate(`/round/coding/${encodeURIComponent(previous.id)}`);
      return;
    }
    setNavigationState(null);
    setError('No previous coding problem was found for this difficulty yet.');
  }, [attempt, navigate]);

  const handleNewProblem = useCallback(async () => {
    if (!attempt || generating) return;
    setNavigationState('next');
    setGenerating(true);
    const result = await generateCodingAttempt({ domain: attempt.problem.domain, difficulty: attempt.problem.difficulty, forceNew: true });
    setGenerating(false);
    if (result.ok === true) {
      navigate(`/round/coding/${encodeURIComponent(result.data.id)}`, { replace: true });
      return;
    }
    setNavigationState(null);
    setError(result.error);
  }, [attempt, generating, navigate]);

  const finalizeRound = useCallback(async (options: { autoSubmitted?: boolean; navigateOnComplete?: boolean } = {}) => {
    if (!attempt || submitting) return null;
    const navigateOnComplete = options.navigateOnComplete ?? true;
    setSubmitting(true);
    const result = await submitCodingAttempt(attempt.id, {
      code: codeRef.current || code,
      notes: savedNotes,
      timeSpentSeconds: Math.min(elapsedSeconds, attempt.durationMinutes * 60),
      difficulty: attempt.problem.difficulty,
      domain: attempt.problem.domain,
      language: selectedLanguage,
    });
    setSubmitting(false);
    setExpiring(false);
    if (result.ok === false) {
      const refreshed = await fetchCodingAttempt(attempt.id);
      if (refreshed.ok === true && refreshed.data.status === 'submitted') {
        setAttempt(refreshed.data);
        if (navigateOnComplete) {
          navigate(`/results/coding/${encodeURIComponent(refreshed.data.id)}`, options.autoSubmitted ? { replace: true } : undefined);
        }
        return refreshed.data;
      }
      setError(result.error);
      return null;
    }
    setAttempt(result.data);
    if (navigateOnComplete) {
      navigate(`/results/coding/${encodeURIComponent(result.data.id)}`, options.autoSubmitted ? { replace: true } : undefined);
    }
    return result.data;
  }, [attempt, code, elapsedSeconds, navigate, savedNotes, selectedLanguage, submitting]);

  const handleRunCode = useCallback(async () => {
    if (!attempt || runningCode) return;
    setRunPanelOpen(true);
    setRunningCode(true);
    setRunStatus('Preparing runtime...');
    setRunOutput({ stdout: [], stderr: [], notices: [] });
    try {
      const result = await executeCodingSnippet(codeRef.current || code, selectedLanguage, (message) => {
        setRunStatus(message);
      });
      setRunOutput(
        result.stdout.length || result.stderr.length || result.notices.length
          ? result
          : { stdout: [], stderr: [], notices: ['Execution finished with no output. Add console.log or print statements to inspect behavior.'] },
      );
    } catch (executionError) {
      setRunOutput({
        stdout: [],
        stderr: [executionError instanceof Error ? executionError.message : 'Execution failed.'],
        notices: [],
      });
    } finally {
      setRunningCode(false);
      setRunStatus(null);
    }
  }, [attempt, code, runningCode, selectedLanguage]);

  useEffect(() => {
    if (attemptId) return;
    setSelectedLanguage(getPrimaryCodingLanguage(domain));
  }, [attemptId, domain]);

  useEffect(() => {
    if (attemptId) return undefined;
    if (!domain) return undefined;
    let ignore = false;
    setCheckingOverview(true);
    setError(null);
    void fetchCodingOverview(domain).then((result) => {
      if (ignore) return;
      setCheckingOverview(false);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setSuggestionMessage(result.data.suggestionMessage);
      setActiveAttemptId(result.data.activeAttemptId ?? null);
    });
    return () => {
      ignore = true;
    };
  }, [attemptId, domain]);

  useEffect(() => {
    if (attemptId || !domain) return undefined;
    let ignore = false;
    setHistoryLoading(true);
    void fetchCodingHistory(domain).then((result) => {
      if (ignore) return;
      setHistoryLoading(false);
      if (result.ok === false) {
        setError(result.error);
        setHistoryItems([]);
        return;
      }
      setHistoryItems(result.data);
    });
    return () => {
      ignore = true;
    };
  }, [attemptId, domain]);

  useEffect(() => {
    if (!attemptId) {
      setAttempt(null);
      setActiveAttemptId(null);
      setSelectedLanguage(getPrimaryCodingLanguage(domain));
      setCode('');
      setSavedNotes('');
      setNotesDraft('');
      setNotesSurfaceOpen(false);
      setNavigationState(null);
      return undefined;
    }
    let ignore = false;
    autoSubmitHandledRef.current = false;
    setLoadingAttempt(true);
    setError(null);
    void fetchCodingAttempt(attemptId).then(async (result) => {
      if (ignore) return;
      setLoadingAttempt(false);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      if (result.data.status === 'submitted') {
        navigate(`/results/coding/${encodeURIComponent(result.data.id)}`, { replace: true });
        return;
      }
      setAttempt(result.data);

      let restoredCode = result.data.code || result.data.problem.starterCode;
      let restoredNotes = result.data.notes || '';
      let restoredLanguage = normalizeClientCodingLanguage(result.data.language, getPrimaryCodingLanguage(result.data.problem.domain));
      const serverDraft = await fetchServerDraft<CodingDraftPayload>('coding-round', result.data.id);
      const localDraft = readLocalDraft<CodingDraftPayload>('coding-round', result.data.id);
      if (serverDraft.ok && serverDraft.data?.payload?.code) {
        restoredCode = serverDraft.data.payload.code;
        restoredNotes = serverDraft.data.payload.notes ?? restoredNotes;
        restoredLanguage = normalizeClientCodingLanguage(serverDraft.data.payload.language, restoredLanguage);
      }
      if (localDraft?.payload?.code) {
        const useLocal = shouldPromptForLocalDraft(localDraft.savedAt, serverDraft.ok ? serverDraft.data?.savedAt : null)
          ? window.confirm('We found a more recent local coding draft. Restore it?')
          : !serverDraft.ok || !serverDraft.data?.payload?.code;
        if (useLocal) {
          restoredCode = localDraft.payload.code;
          restoredNotes = localDraft.payload.notes ?? restoredNotes;
          restoredLanguage = normalizeClientCodingLanguage(localDraft.payload.language, restoredLanguage);
        }
      }
      setCode(restoredCode);
      codeRef.current = restoredCode;
      setSavedNotes(restoredNotes);
      setNotesDraft(restoredNotes);
      setNotesSurfaceOpen(false);
      setSelectedLanguage(restoredLanguage);
      setSavedAt(result.data.savedAt ?? null);
      setNavigationState(null);
    });
    return () => {
      ignore = true;
    };
  }, [attemptId, domain, navigate]);

  useEffect(() => {
    setDomainConfirmed(Boolean(attemptId));
  }, [attemptId, domain]);

  useEffect(() => {
    if (attemptId) setLaunchFlowStarted(true);
  }, [attemptId]);

  useEffect(() => {
    if (!attempt) return undefined;
    const save = () => {
      const payload = { code: codeRef.current, notes: savedNotes, language: selectedLanguage, savedAt: new Date().toISOString() };
      saveLocalDraft('coding-round', attempt.id, payload);
      void saveServerDraft('coding-round', attempt.id, payload);
    };
    const interval = window.setInterval(save, 60_000);
    const onHidden = () => {
      if (document.hidden) save();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [attempt, savedNotes, selectedLanguage]);

  useEffect(() => {
    if (!attempt) return undefined;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.id]);

  useEffect(() => {
    if (!attempt || !roundExpired || submitting || autoSubmitHandledRef.current) return;
    autoSubmitHandledRef.current = true;
    setExpiring(true);
    void finalizeRound({ autoSubmitted: true, navigateOnComplete: true });
  }, [attempt, finalizeRound, roundExpired, submitting]);

  useEffect(() => {
    if (!generating) return undefined;
    generationStartedAtRef.current = Date.now();
    const writeCountdown = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - (generationStartedAtRef.current ?? Date.now())) / 1000));
      if (generationPhaseRef.current) generationPhaseRef.current.textContent = 'Generating your problem... (1/1)';
      if (elapsedRef.current) elapsedRef.current.textContent = `${elapsed}s`;
      if (remainingRef.current) remainingRef.current.textContent = `${Math.max(0, CODING_GENERATION_ESTIMATED_TOTAL_SECONDS - elapsed)}s`;
    };
    writeCountdown();
    const timer = window.setInterval(writeCountdown, 1000);
    return () => {
      window.clearInterval(timer);
      generationStartedAtRef.current = null;
    };
  }, [generating]);

  if (!domain) {
    return (
      <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
        <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
        <main className="relative z-10 mx-auto w-full max-w-4xl">
          <section className="surface-card">
            <p className="text-body-md text-red-700">Choose your interview domain in onboarding before opening the coding round.</p>
          </section>
        </main>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="min-h-screen bg-background text-primary">
        <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-20" />
        {generating ? (
          <div className="fixed inset-0 z-120 flex items-center justify-center bg-[#0f0f10] text-[#f7f2e8]">
            <div className="rounded-2xl border border-[#2b2b2d] bg-[#151516] px-6 py-5 text-center shadow-2xl">
              <LoaderCircle size={24} className="mx-auto animate-spin text-[#f7f2e8]" />
              <p ref={generationPhaseRef} className="mt-4 text-body-lg text-[#f7f2e8]">Generating your problem... (1/1)</p>
              <p className="mt-2 text-body-md text-[#a7a19a]">Elapsed: <span ref={elapsedRef}>0s</span></p>
              <p className="mt-1 text-body-md text-[#a7a19a]">Estimated total: ~{CODING_GENERATION_ESTIMATED_TOTAL_SECONDS}s</p>
              <p className="mt-1 text-body-md text-[#a7a19a]">Estimated time remaining: <span ref={remainingRef}>{CODING_GENERATION_ESTIMATED_TOTAL_SECONDS}s</span></p>
            </div>
          </div>
        ) : null}
          {launchFlowStarted && !domainConfirmed ? (
          <RoundDomainGate roundTitle="CODING ROUND" domain={domain} subject="coding problems" onConfirmed={() => setDomainConfirmed(true)} />
        ) : null}
          {launchFlowStarted && domainConfirmed ? <div className="fixed inset-0 z-70 flex items-center justify-center bg-[#0d0d0f]/96 px-4 backdrop-blur-sm">
            <div className="relative w-full max-w-4xl rounded-[32px] border border-[#2d2d31] bg-[#111113] p-8 text-[#f6efe3] shadow-[0_32px_90px_rgba(0,0,0,0.45)]">
              <p className="text-ui-label tracking-[0.22em] text-[#9f9a92]">CODING ROUND</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-headline-lg text-[#fbf7f0]">Pick your difficulty before the timer starts.</h1>
                <span className="rounded-full border border-[#34343a] bg-[#1a1a1d] px-3 py-1 text-ui-label text-[#f0e5d0]">{domainLabel}</span>
              </div>
              <p className="mt-3 max-w-3xl text-body-lg text-[#b3aca2]">
                You will get one domain-specific coding problem, realistic starter code, and one submission. The language is fixed by your domain.
              </p>
              {suggestionMessage ? <p className="mt-4 text-body-md text-[#e6c77e]">{suggestionMessage}</p> : null}
              {error ? <p className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-body-md text-red-200">{error}</p> : null}
              {checkingOverview ? <p className="mt-4 text-body-md text-[#b3aca2]">Checking for active coding rounds...</p> : null}
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {([
                  ['easy', 'Foundational patterns, standard implementations'],
                  ['medium', 'Real interview complexity, edge cases required'],
                  ['hard', 'Senior-level problems, optimal solutions expected'],
                ] as Array<[CodingDifficulty, string]>).map(([difficulty, description]) => (
                  <button
                    key={difficulty}
                    type="button"
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`rounded-3xl border p-5 text-left transition-colors ${difficultyCardClasses(difficulty, selectedDifficulty === difficulty)}`}
                  >
                    <p className="text-headline-sm capitalize">{difficulty}</p>
                    <p className="mt-3 text-body-md">{description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!selectedDifficulty || generating || checkingOverview}
                  onClick={() => { void startCodingRound(); }}
                  className="rounded-full bg-[#f3e7d0] px-6 py-3 text-ui-label text-[#111113] transition-colors hover:bg-[#e8d8ba] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? 'Generating...' : activeAttemptId ? 'Start New Coding Round' : 'Start Coding Round'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLaunchFlowStarted(false);
                    setDomainConfirmed(false);
                  }}
                  className="rounded-full border border-[#34343a] px-6 py-3 text-ui-label text-[#f6efe3] hover:bg-[#1a1a1d]"
                >
                  Back
                </button>
              </div>
            </div>
          </div> : null}
          {!launchFlowStarted || !domainConfirmed ? <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 lg:px-16">
            <section className="rounded-[28px] border border-blueprint-line bg-card p-6 shadow-[0_24px_48px_rgba(0,0,0,0.06)] sm:p-8">
              <p className="text-ui-label text-blueprint-muted">Coding Round</p>
              <h1 className="mt-3 text-display-xl text-primary">Practice one timed coding round for {domainLabel}.</h1>
              <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
                Start from a clean coding round landing page, then continue into the usual confirmation and difficulty flow when you are ready.
              </p>
              {suggestionMessage ? <p className="mt-4 text-body-md text-[#7a5d18]">{suggestionMessage}</p> : null}
              {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}
              {checkingOverview ? <p className="mt-4 text-body-md text-blueprint-muted">Checking for active coding rounds...</p> : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLaunchFlowStarted(true);
                    setError(null);
                  }}
                  className="rounded-full bg-primary px-6 py-3 text-ui-label text-white hover:bg-[#303031]"
                >
                  {activeAttemptId ? 'Start New Coding Round' : 'Start Coding Round'}
                </button>
                {activeAttemptId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/round/coding/${encodeURIComponent(activeAttemptId)}`)}
                    className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]"
                  >
                    Resume Active Round
                  </button>
                ) : null}
              </div>
            </section>

            <section className="surface-card">
              <div className="flex items-center gap-3">
                <History size={18} className="text-blueprint-muted" />
                <div>
                  <p className="text-ui-label text-blueprint-muted">Session History</p>
                  <h2 className="text-headline-md text-primary">Recent coding attempts</h2>
                </div>
              </div>
              {historyLoading ? <p className="mt-4 text-body-md text-blueprint-muted">Loading coding history...</p> : null}
              {!historyLoading && historyItems.length === 0 ? <p className="mt-4 text-body-md text-blueprint-muted">No coding attempts yet. Start your first round to build history here.</p> : null}
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {historyItems.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-blueprint-line bg-blueprint-bg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-ui-label text-blueprint-muted">{formatAttemptDate(item.submittedAt ?? item.startedAt)}</p>
                        <h3 className="mt-2 text-headline-md text-primary">
                          <button type="button" onClick={() => openHistoryAttempt(item)} className="text-left hover:underline">
                            {item.problem.title}
                          </button>
                        </h3>
                        <p className="mt-1 text-body-md text-blueprint-muted">{formatLanguageLabel(item.language)} · {item.problem.difficulty} · {codingStatusLabel(item)}</p>
                      </div>
                      <span className="rounded-full border border-blueprint-line bg-white px-3 py-1 text-ui-label text-primary">{codingScoreLabel(item)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => { void handleHistorySave(item); }}
                        disabled={historySaveId === item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-card px-4 py-2 text-ui-label text-primary hover:bg-[#f5f3f3] disabled:opacity-60"
                      >
                        {historySaveId === item.id ? <LoaderCircle size={15} className="animate-spin" /> : item.savedAt ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                        {historySaveId === item.id ? 'Saving...' : item.savedAt ? 'Saved' : 'Save'}
                      </button>
                      {item.status === 'submitted' ? (
                        <button type="button" onClick={() => navigate(`/results/coding/${encodeURIComponent(item.id)}`)} className="rounded-full bg-primary px-4 py-2 text-ui-label text-white hover:bg-[#303031]">
                          View Results
                        </button>
                      ) : (
                        <button type="button" onClick={() => navigate(`/round/coding/${encodeURIComponent(item.id)}`)} className="rounded-full bg-primary px-4 py-2 text-ui-label text-white hover:bg-[#303031]">
                          Resume
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </main> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#f7f2e8]">
      <RoundShell
        attemptId={attempt?.id}
        feature="coding-round"
        label={`${domainLabel} Coding Round`}
        startedAt={attempt?.startedAt}
        counter={attempt?.problem.title}
        timerLimitSeconds={attempt ? attempt.durationMinutes * 60 : 45 * 60}
        onEndEarly={() => { void finalizeRound(); }}
        onMaxVisibilityLeaves={() => { void finalizeRound({ autoSubmitted: true, navigateOnComplete: false }); }}
        kickOutResultsPath={attempt ? `/results/coding/${encodeURIComponent(attempt.id)}` : undefined}
        kickOutTopic={attempt?.problem.title}
        kickOutCompletedLabel={code.trim() ? 'Your current draft will be submitted.' : 'No solution was drafted yet.'}
      >
        {expiring ? (
          <div className="fixed inset-0 z-95 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="max-w-md rounded-2xl border border-[#2d2d31] bg-[#151516] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <p className="text-ui-label text-[#9f9a92]">Time Is Up</p>
              <h2 className="mt-3 text-headline-lg text-[#fbf7f0]">Submitting your coding round now.</h2>
              <p className="mt-3 text-body-md text-[#b3aca2]">Your current code and notes are being finalized.</p>
            </div>
          </div>
        ) : null}
        {navigationState ? (
          <div className="fixed inset-0 z-95 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
            <div className="rounded-2xl border border-[#2d2d31] bg-[#151516] px-6 py-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <LoaderCircle size={22} className="mx-auto animate-spin text-[#f7f2e8]" />
              <p className="mt-4 text-body-lg text-[#f7f2e8]">{navigationState === 'previous' ? 'Loading previous problem...' : 'Loading next problem...'}</p>
            </div>
          </div>
        ) : null}
        <main className="relative z-10 mx-auto flex h-[calc(100vh-72px)] w-full max-w-400 overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          {loadingAttempt ? <p className="text-body-md text-[#b3aca2]">Loading coding attempt...</p> : null}
          {error && !attempt ? <p className="text-body-md text-red-300">{error}</p> : null}
          {attempt ? (
            <section className="flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-[#2d2d31] bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:flex-row">
              <aside className="flex h-full w-full flex-col overflow-y-auto border-b border-[#242427] bg-[#151517] px-6 py-6 lg:w-2/5 lg:border-b-0 lg:border-r">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-ui-label ${difficultyBadgeClasses(attempt.problem.difficulty)}`}>{attempt.problem.difficulty}</span>
                    <span className="rounded-full border border-[#333338] bg-[#1d1d21] px-3 py-1 text-ui-label text-[#f1e5d0]">{domainLabel}</span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => { void handleSaveAttempt(); }} disabled={savingAttempt} className="inline-flex items-center gap-2 rounded-full border border-[#333338] px-4 py-2 text-[#f6efe3] hover:bg-[#202025] disabled:opacity-60" aria-label="Save coding attempt">
                      {savingAttempt ? <LoaderCircle size={16} className="animate-spin" /> : savedAt ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                      <span className="text-ui-label">{savingAttempt ? 'Saving...' : savedAt ? 'Saved' : 'Save'}</span>
                    </button>
                    <button type="button" onClick={openNotesSurface} className="rounded-full border border-[#333338] p-2 text-[#f6efe3] hover:bg-[#202025]" aria-label="Open notes workspace">
                      <NotebookPen size={17} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-ui-label text-[#9f9a92]">{savedAt ? `Saved ${formatAttemptDate(savedAt)}` : 'Not saved yet'}</p>
                <div className="mt-5 flex items-start justify-between gap-3">
                  <h1 className="text-headline-lg text-[#fbf7f0]">{attempt.problem.title}</h1>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => { void handlePreviousProblem(); }} className="rounded-full border border-[#333338] p-2 text-[#f6efe3] hover:bg-[#202025]" aria-label="Previous problem"><ChevronLeft size={16} /></button>
                    <button type="button" onClick={() => { void handleNewProblem(); }} className="rounded-full border border-[#333338] p-2 text-[#f6efe3] hover:bg-[#202025]" aria-label="Next problem"><ChevronRight size={16} /></button>
                    <button type="button" onClick={() => { void handleNewProblem(); }} className="rounded-full border border-[#333338] p-2 text-[#f6efe3] hover:bg-[#202025]" aria-label="Shuffle problem"><Shuffle size={16} /></button>
                  </div>
                </div>
                <p className="mt-5 text-body-lg text-[#cdc6bb]">{attempt.problem.problemStatement}</p>

                <section className="mt-8">
                  <h2 className="text-ui-label tracking-[0.18em] text-[#9f9a92]">Requirements</h2>
                  <ol className="mt-4 space-y-3 text-body-md text-[#f2ede4]">
                    {attempt.problem.requirements.map((item, index) => (
                      <li key={item} className="rounded-2xl border border-[#2a2a2f] bg-[#101013] px-4 py-3">
                        <span className="text-[#9f9a92]">{index + 1}. </span>{item}
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="mt-8">
                  <h2 className="text-ui-label tracking-[0.18em] text-[#9f9a92]">Examples</h2>
                  <div className="mt-4 space-y-4">
                    {attempt.problem.examples.map((example, index) => (
                      <article key={`${example.input}-${index}`} className="rounded-2xl border border-[#2a2a2f] bg-[#101013] p-4">
                        <p className="text-ui-label text-[#f6efe3]">Example {index + 1}</p>
                        <div className="mt-3 rounded-xl bg-[#17171b] p-3 font-mono text-sm text-[#ded8cf]">
                          <p>Input: {example.input}</p>
                          <p className="mt-2">Output: {example.output}</p>
                          <p className="mt-2 text-[#b8b0a4]">Explanation: {example.explanation}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="mt-8 pb-4">
                  <h2 className="text-ui-label tracking-[0.18em] text-[#9f9a92]">Constraints</h2>
                  <ul className="mt-4 space-y-2 text-body-md text-[#cdc6bb]">
                    {attempt.problem.constraints.map((item) => (
                      <li key={item} className="rounded-xl border border-[#2a2a2f] bg-[#101013] px-4 py-3">{item}</li>
                    ))}
                  </ul>
                </section>
              </aside>

              <section className="relative flex h-full w-full min-w-0 flex-col bg-[#0f0f10] lg:w-3/5">
                {notesSurfaceOpen ? (
                  <>
                    <div className="flex items-center justify-between border-b border-[#242427] bg-[#141416] px-5 py-4">
                      <div>
                        <p className="text-ui-label tracking-[0.18em] text-[#9f9a92]">NOTES WORKSPACE</p>
                        <h2 className="mt-2 text-headline-md text-[#f6efe3]">Save notes separately from the coding editor.</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => { void handleSaveNotes(); }}
                          disabled={savingNotes}
                          className="rounded-full bg-emerald-600 px-5 py-2.5 text-ui-label text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {savingNotes ? 'Saving Notes...' : 'Save Notes'}
                        </button>
                        <button
                          type="button"
                          onClick={closeNotesSurface}
                          className="rounded-full border border-[#333338] px-5 py-2.5 text-ui-label text-[#f6efe3] hover:bg-[#202025]"
                        >
                          Go Back To Coding Area
                        </button>
                      </div>
                    </div>
                    <div className="flex h-full flex-col overflow-hidden px-5 py-5">
                      <div className="rounded-2xl border border-[#2a2a2f] bg-[#101013] px-4 py-3 text-body-md text-[#b8b0a4]">
                        Unsaved notes are cleared when you leave this workspace. Reopening notes starts from your last saved version only.
                      </div>
                      <div className="mt-5 flex-1 rounded-2xl border border-[#2a2a2f] bg-[#111114] p-4">
                        <textarea
                          ref={notesTextareaRef}
                          value={notesDraft}
                          onChange={(event) => setNotesDraft(event.target.value)}
                          className="h-full min-h-[calc(100vh-240px)] w-full resize-none rounded-2xl border border-[#2a2a2f] bg-[#101013] p-5 text-body-md text-[#f2ede4] outline-none"
                          placeholder="Write the tradeoffs, edge cases, validation plan, or intended output you want to keep with this coding round."
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-[#242427] bg-[#141416] px-5 py-4">
                      <div className="relative">
                        <select
                          value={selectedLanguage}
                          onChange={(event) => { void handleLanguageChange(normalizeClientCodingLanguage(event.target.value, getPrimaryCodingLanguage(attempt.problem.domain))); }}
                          disabled={languageOptions.length <= 1}
                          className="appearance-none rounded-full border border-[#2e2e33] bg-[#1b1b20] px-3 py-1 pr-9 text-ui-label text-[#f6efe3] outline-none transition-colors hover:border-[#4a4a50] disabled:cursor-default disabled:opacity-90"
                        >
                          {languageOptions.map((option) => (
                            <option key={option.value} value={option.value} className="bg-[#111113] text-[#f6efe3]">
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9f9a92]" />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => { void handleRunCode(); }}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-ui-label text-white hover:bg-emerald-500"
                        >
                          <Play size={16} /> {runningCode ? 'Running...' : 'Run Code'}
                        </button>
                        <button
                          type="button"
                          disabled={submitting || expiring}
                          onClick={() => { void finalizeRound(); }}
                          className="rounded-full bg-sky-600 px-5 py-2.5 text-ui-label text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                      </div>
                    </div>

                    <div className="border-b border-[#242427] px-4 py-4">
                      <Suspense fallback={<div className="h-full animate-pulse rounded-2xl border border-[#2a2a2f] bg-[#111114]" />}>
                        <div className="relative overflow-hidden rounded-2xl border border-[#2a2a2f] bg-[#111114]" style={{ height: 'calc(100vh - 180px)', overflow: 'hidden' }}>
                          <div className={starterLoading ? 'h-full opacity-45 transition-opacity' : 'h-full transition-opacity'}>
                          <LazyCodeEditor
                            value={code}
                            language={selectedLanguage}
                            editable={!submitting && !expiring && !starterLoading}
                            height="100%"
                            onEditorReady={(view) => {
                              editorViewRef.current = view;
                            }}
                            onChange={(value) => {
                              codeRef.current = value;
                              setCode(value);
                              saveLocalDraft('coding-round', attempt.id, { code: value, notes: savedNotes, language: selectedLanguage, savedAt: new Date().toISOString() });
                            }}
                          />
                          </div>
                          {starterLoading ? (
                            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/15">
                              <span className="inline-flex items-center gap-2 rounded-full border border-[#333338] bg-[#141416] px-4 py-2 text-ui-label text-[#f6efe3] shadow-xl">
                                <LoaderCircle size={16} className="animate-spin" /> Loading starter code...
                              </span>
                            </div>
                          ) : null}
                          {starterError ? <p className="absolute left-4 top-4 z-30 rounded-full border border-red-500/40 bg-red-950/80 px-4 py-2 text-ui-label text-red-100">{starterError}</p> : null}
                          <div className={`pointer-events-none absolute inset-x-4 bottom-4 z-20 transition-all duration-200 ${runPanelOpen ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
                            <div className="pointer-events-auto h-50 overflow-hidden rounded-2xl border border-[#284535] bg-[rgba(8,12,10,0.94)] shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                              <div className="flex items-center justify-between border-b border-[#1e3227] px-4 py-3">
                                <p className="font-mono text-xs tracking-[0.24em] text-[#8bcf9f]">OUTPUT</p>
                                <button
                                  type="button"
                                  onClick={() => setRunPanelOpen(false)}
                                  className="rounded-full border border-[#335341] p-2 text-[#d8f5de] hover:bg-[#173024]"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                              <div className="h-38 overflow-y-auto px-4 py-3 font-mono text-sm">
                                {runningCode && runStatus ? <p className="text-[#facc15]">{runStatus}</p> : null}
                                {runOutput.notices.map((line) => (
                                  <p key={`notice-${line}`} className="text-[#facc15]">{line}</p>
                                ))}
                                {runOutput.stdout.map((line, index) => (
                                  <p key={`stdout-${index}-${line}`} className="text-[#86efac]">{line}</p>
                                ))}
                                {runOutput.stderr.map((line, index) => (
                                  <p key={`stderr-${index}-${line}`} className="whitespace-pre-wrap text-[#f87171]">{line}</p>
                                ))}
                                {!runningCode && !runOutput.stdout.length && !runOutput.stderr.length && !runOutput.notices.length ? (
                                  <p className="text-[#6ee7b7]">Run your code to inspect stdout and runtime errors here.</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Suspense>
                    </div>
                  </>
                )}

              </section>
            </section>
          ) : null}
        </main>
      </RoundShell>
    </div>
  );
}
