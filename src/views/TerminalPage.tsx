import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, History, LoaderCircle, Mic, MicOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import RoundDomainGate from '../components/RoundDomainGate';
import RoundShell from '../components/RoundShell';
import { DOMAIN_LABELS } from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';
import {
  MOCK_ANSWER_PHASE_SECONDS,
  MOCK_INTERVIEW_QUESTION_COUNT,
  MOCK_READING_PHASE_SECONDS,
  MOCK_TOTAL_DURATION_MINUTES,
  fetchMockOverview,
  fetchMockInterview,
  finishMockInterview,
  respondToMockQuestion,
  saveMockInterview,
  startMockInterview,
  type MockInterviewHistoryItem,
  type MockInterviewState,
  type MockInterviewType,
  type MockLevel,
  type MockPersona,
  type MockQuestionType,
} from '../lib/mockInterview';
import { View } from '../App';

interface TerminalPageProps {
  onViewChange: (view: View) => void;
}

const LEVELS: Array<{ id: MockLevel; title: string; body: string }> = [
  { id: 'junior', title: 'Junior', body: '0-2 years' },
  { id: 'mid', title: 'Mid', body: '2-5 years' },
  { id: 'senior', title: 'Senior', body: '5+ years' },
];

const TYPES: Array<{ id: MockInterviewType; title: string; body: string }> = [
  { id: 'technical', title: 'Technical Deep Dive', body: 'Heavy on domain-specific technical questions.' },
  { id: 'design', title: 'System Design', body: 'Architecture and design decisions.' },
  { id: 'mixed', title: 'Behavioral + Technical Mix', body: 'Balanced, realistic interview coverage.' },
];

const PERSONAS: Array<{ id: MockPersona; name: string; tag: string; body: string }> = [
  { id: 'alex', name: 'Alex', tag: 'Supportive Mentor', body: 'Encouraging, thorough, and specific.' },
  { id: 'jordan', name: 'Jordan', tag: 'Skeptical Senior', body: 'Pushes for depth and challenges vague answers.' },
  { id: 'sam', name: 'Sam', tag: 'Startup CTO', body: 'Pragmatic, fast, and focused on judgment.' },
];

function personaMeta(persona: MockPersona) {
  return PERSONAS.find((item) => item.id === persona) ?? PERSONAS[0];
}

function pickNextIndex(interview: MockInterviewState) {
  const answered = new Set(interview.responses.map((item) => item.questionId));
  const next = interview.questions.findIndex((question) => !answered.has(question.id));
  return next === -1 ? Math.max(0, interview.questions.length - 1) : next;
}

function formatInterviewDate(value: string | null) {
  if (!value) return 'Not completed yet';
  return new Date(value).toLocaleDateString();
}

function mockHistoryScoreLabel(item: MockInterviewHistoryItem) {
  if (item.score === null) return item.status === 'completed' ? 'Completed' : 'In progress';
  return `${item.score}/10`;
}

function hasSubmittedMockAnswer(answer: string | null | undefined) {
  return String(answer ?? '').trim().length > 0;
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsedDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function questionTypeBadgeClass(type: MockQuestionType | null | undefined) {
  if (type === 'technical') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (type === 'design') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (type === 'behavioral') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (type === 'situational') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-blueprint-line bg-blueprint-bg text-primary';
}

function questionTypeLabel(type: MockQuestionType | null | undefined) {
  if (type === 'technical') return 'TECHNICAL';
  if (type === 'design') return 'DESIGN';
  if (type === 'behavioral') return 'BEHAVIORAL';
  if (type === 'situational') return 'SITUATIONAL';
  return 'QUESTION';
}

type QuestionPhase = 'reading' | 'answering' | 'submitting';
type FinishStage = 'idle' | 'complete' | 'generating';

export default function TerminalPage(_props: TerminalPageProps) {
  const navigate = useNavigate();
  const params = useParams<{ interviewId?: string }>();
  const interviewId = String(params.interviewId ?? '').trim();
  const workspace = usePrepWorkspace();
  const domain = workspace.selections.domain;
  const domainLabel = DOMAIN_LABELS[domain] ?? 'Selected Domain';
  const [domainConfirmed, setDomainConfirmed] = useState(Boolean(interviewId));
  const [launchFlowStarted, setLaunchFlowStarted] = useState(Boolean(interviewId));
  const [level, setLevel] = useState<MockLevel | null>(null);
  const [interviewType, setInterviewType] = useState<MockInterviewType | null>(null);
  const [persona, setPersona] = useState<MockPersona | null>(null);
  const [overview, setOverview] = useState<{ activeInterviewId: string | null; history: MockInterviewHistoryItem[] } | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [historySaveId, setHistorySaveId] = useState<string | null>(null);
  const [interview, setInterview] = useState<MockInterviewState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedLoading, setElapsedLoading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<QuestionPhase>('reading');
  const [finishStage, setFinishStage] = useState<FinishStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [questionVisible, setQuestionVisible] = useState(false);
  const [completedTimeTakenSeconds, setCompletedTimeTakenSeconds] = useState(0);
  const recognitionRef = useRef<any>(null);
  const draftRef = useRef('');
  const readingCountdownRef = useRef<HTMLSpanElement | null>(null);
  const readingUnlockRef = useRef<HTMLSpanElement | null>(null);
  const readingOverlayCountdownRef = useRef<HTMLSpanElement | null>(null);
  const answerCountdownRef = useRef<HTMLSpanElement | null>(null);
  const answerTimerShellRef = useRef<HTMLDivElement | null>(null);
  const readingIntervalRef = useRef<number | null>(null);
  const answerIntervalRef = useRef<number | null>(null);
  const readingSecondsRemainingRef = useRef(MOCK_READING_PHASE_SECONDS);
  const answerSecondsRemainingRef = useRef(MOCK_ANSWER_PHASE_SECONDS);
  const finishDelayRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const questionFadeFrameRef = useRef<number | null>(null);
  const autoVoiceAllowedRef = useRef(true);

  const question = interview?.questions[currentIndex] ?? null;
  const currentResponse = question ? interview?.responses.find((item) => item.questionId === question.id) ?? null : null;
  const meta = personaMeta(interview?.persona ?? persona ?? 'alex');
  const setupReady = Boolean(level && interviewType && persona);
  const answeredCount = interview?.responses.filter((item) => hasSubmittedMockAnswer(item.answer)).length ?? 0;
  const voiceSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const overviewHistory = overview?.history ?? [];

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!voiceSupported || listening) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          transcript += event.results[index][0].transcript;
        }
      }
      const normalizedTranscript = transcript.trim();
      if (!normalizedTranscript) return;
      setDraft((current) => {
        const nextValue = `${current}${current ? ' ' : ''}${normalizedTranscript}`.trim();
        draftRef.current = nextValue;
        return nextValue;
      });
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, phase, voiceSupported]);

  const clearReadingTimer = useCallback(() => {
    if (readingIntervalRef.current !== null) {
      window.clearInterval(readingIntervalRef.current);
      readingIntervalRef.current = null;
    }
  }, []);

  const clearAnswerTimer = useCallback(() => {
    if (answerIntervalRef.current !== null) {
      window.clearInterval(answerIntervalRef.current);
      answerIntervalRef.current = null;
    }
  }, []);

  const clearPhaseTimers = useCallback(() => {
    clearReadingTimer();
    clearAnswerTimer();
  }, [clearAnswerTimer, clearReadingTimer]);

  const clearFinishDelay = useCallback(() => {
    if (finishDelayRef.current !== null) {
      window.clearTimeout(finishDelayRef.current);
      finishDelayRef.current = null;
    }
  }, []);

  const clearToastTimeout = useCallback(() => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, []);

  const setReadingCountdown = useCallback((secondsRemaining: number) => {
    const nextValue = String(Math.max(0, secondsRemaining));
    if (readingCountdownRef.current) readingCountdownRef.current.textContent = nextValue;
    if (readingUnlockRef.current) readingUnlockRef.current.textContent = nextValue;
    if (readingOverlayCountdownRef.current) readingOverlayCountdownRef.current.textContent = nextValue;
  }, []);

  const setAnswerCountdown = useCallback((secondsRemaining: number) => {
    if (answerCountdownRef.current) {
      answerCountdownRef.current.textContent = formatCountdown(Math.max(0, secondsRemaining));
    }
    if (!answerTimerShellRef.current) return;
    const toneClasses = secondsRemaining <= 30
      ? 'border-red-200 bg-red-50 text-red-700 animate-pulse'
      : secondsRemaining <= 90
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-blueprint-line bg-blueprint-bg text-primary';
    answerTimerShellRef.current.className = `rounded-2xl border px-5 py-4 text-center transition-all ${toneClasses}`;
  }, []);

  const finishInterview = useCallback(async (sourceInterview?: MockInterviewState) => {
    const activeInterview = sourceInterview ?? interview;
    if (!activeInterview || finishStage !== 'idle') return;
    clearPhaseTimers();
    stopListening();
    clearFinishDelay();
    clearToastTimeout();
    setCompletedTimeTakenSeconds(Math.max(0, Math.floor((Date.now() - new Date(activeInterview.startedAt).getTime()) / 1000)));
    setFinishStage('complete');
    finishDelayRef.current = window.setTimeout(() => {
      setFinishStage('generating');
      setElapsedLoading(0);
      void finishMockInterview(activeInterview.id).then((result) => {
        setFinishStage('idle');
        if (result.ok === false) {
          setError(result.error);
          return;
        }
        navigate(`/results/mock/${encodeURIComponent(activeInterview.id)}`, { replace: true });
      });
    }, 2_000);
  }, [clearFinishDelay, clearPhaseTimers, clearToastTimeout, finishStage, interview, navigate, stopListening]);

  const submitAnswer = useCallback(async (options: { autoSubmitted?: boolean } = {}) => {
    if (!interview || !question || submitting || finishStage !== 'idle') return;
    clearPhaseTimers();
    stopListening();
    setSubmitting(true);
    setPhase('submitting');
    setError(null);
    const timeSpentSeconds = Math.max(0, MOCK_ANSWER_PHASE_SECONDS - answerSecondsRemainingRef.current);
    const result = await respondToMockQuestion(interview.id, {
      questionId: question.id,
      answer: draftRef.current,
      followUpAnswer: followUpDraft.trim() || undefined,
      timeSpentSeconds,
    });
    setSubmitting(false);
    if (result.ok === false) {
      setError(result.error);
      setPhase('answering');
      setAnswerCountdown(Math.max(1, answerSecondsRemainingRef.current));
      if (answerSecondsRemainingRef.current > 0) {
        answerIntervalRef.current = window.setInterval(() => {
          answerSecondsRemainingRef.current = Math.max(0, answerSecondsRemainingRef.current - 1);
          setAnswerCountdown(answerSecondsRemainingRef.current);
          if (answerSecondsRemainingRef.current <= 0) {
            clearAnswerTimer();
            void submitAnswer({ autoSubmitted: true });
          }
        }, 1000);
      }
      return;
    }

    const updatedInterview = result.data.interview;
    const completed = updatedInterview.responses.length >= updatedInterview.questions.length || currentIndex >= updatedInterview.questions.length - 1;
    setInterview(updatedInterview);
    setDraft('');
    draftRef.current = '';
    setFollowUpDraft('');

    const advance = () => {
      if (completed) {
        void finishInterview(updatedInterview);
        return;
      }
      setCurrentIndex(updatedInterview.currentQuestionIndex);
    };

    if (options.autoSubmitted) {
      clearToastTimeout();
      setToastMessage("Time's up — answer recorded");
      toastTimeoutRef.current = window.setTimeout(() => {
        setToastMessage(null);
        advance();
      }, 2_000);
      return;
    }

    advance();
  }, [clearAnswerTimer, clearPhaseTimers, clearToastTimeout, currentIndex, finishInterview, finishStage, followUpDraft, interview, question, setAnswerCountdown, stopListening, submitting]);

  const beginAnswerPhase = useCallback(() => {
    clearPhaseTimers();
    setPhase('answering');
    answerSecondsRemainingRef.current = MOCK_ANSWER_PHASE_SECONDS;
    setAnswerCountdown(answerSecondsRemainingRef.current);
    if (voiceSupported && autoVoiceAllowedRef.current) {
      startListening();
    }
    answerIntervalRef.current = window.setInterval(() => {
      answerSecondsRemainingRef.current = Math.max(0, answerSecondsRemainingRef.current - 1);
      setAnswerCountdown(answerSecondsRemainingRef.current);
      if (answerSecondsRemainingRef.current <= 0) {
        clearAnswerTimer();
        void submitAnswer({ autoSubmitted: true });
      }
    }, 1000);
  }, [clearAnswerTimer, clearPhaseTimers, setAnswerCountdown, startListening, submitAnswer, voiceSupported]);

  const beginReadingPhase = useCallback(() => {
    clearPhaseTimers();
    stopListening();
    autoVoiceAllowedRef.current = true;
    setPhase('reading');
    readingSecondsRemainingRef.current = MOCK_READING_PHASE_SECONDS;
    setReadingCountdown(readingSecondsRemainingRef.current);
    setQuestionVisible(false);
    if (questionFadeFrameRef.current !== null) {
      window.cancelAnimationFrame(questionFadeFrameRef.current);
    }
    questionFadeFrameRef.current = window.requestAnimationFrame(() => setQuestionVisible(true));
    readingIntervalRef.current = window.setInterval(() => {
      readingSecondsRemainingRef.current = Math.max(0, readingSecondsRemainingRef.current - 1);
      setReadingCountdown(readingSecondsRemainingRef.current);
      if (readingSecondsRemainingRef.current <= 0) {
        clearReadingTimer();
        beginAnswerPhase();
      }
    }, 1000);
  }, [beginAnswerPhase, clearPhaseTimers, clearReadingTimer, setReadingCountdown, stopListening]);

  useEffect(() => {
    if (!interviewId) return undefined;
    let ignore = false;
    setLoading(true);
    setError(null);
    void fetchMockInterview(interviewId).then((result) => {
      if (ignore) return;
      setLoading(false);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      if (result.data.status === 'completed') {
        navigate(`/results/mock/${encodeURIComponent(result.data.id)}`, { replace: true });
        return;
      }
      setInterview(result.data);
      setCurrentIndex(pickNextIndex(result.data));
    });
    return () => {
      ignore = true;
    };
  }, [interviewId, navigate]);

  useEffect(() => {
    if (!domain || interviewId) return undefined;
    let ignore = false;
    setLoadingOverview(true);
    void fetchMockOverview(domain).then((result) => {
      if (ignore) return;
      setLoadingOverview(false);
      if (result.ok === false) {
        setOverview(null);
        setError(result.error);
        return;
      }
      setOverview({
        activeInterviewId: result.data.activeInterviewId,
        history: result.data.history,
      });
    });
    return () => {
      ignore = true;
    };
  }, [domain, interviewId]);

  useEffect(() => {
    if (interviewId) setLaunchFlowStarted(true);
  }, [interviewId]);

  useEffect(() => {
    if (!loading && finishStage !== 'generating') return undefined;
    const started = Date.now();
    const interval = window.setInterval(() => setElapsedLoading(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [finishStage, loading]);

  useEffect(() => {
    if (!question) return;
    setDraft(currentResponse?.answer ?? '');
    draftRef.current = currentResponse?.answer ?? '';
    setFollowUpDraft(currentResponse?.followUpAnswer ?? '');
  }, [currentResponse?.answer, currentResponse?.followUpAnswer, question?.id]);

  useEffect(() => {
    if (!interview || !question || currentResponse || finishStage !== 'idle') return undefined;
    beginReadingPhase();
    return undefined;
  }, [beginReadingPhase, currentResponse, finishStage, interview, question]);

  useEffect(() => () => {
    clearPhaseTimers();
    clearFinishDelay();
    clearToastTimeout();
    stopListening();
    if (questionFadeFrameRef.current !== null) {
      window.cancelAnimationFrame(questionFadeFrameRef.current);
    }
  }, [clearFinishDelay, clearPhaseTimers, clearToastTimeout, stopListening]);

  const startInterview = useCallback(async () => {
    if (!level || !interviewType || !persona || loading) return;
    setLoading(true);
    setElapsedLoading(0);
    setError(null);
    const result = await startMockInterview({ domain, level, interviewType, persona, forceNew: Boolean(overview?.activeInterviewId) });
    setLoading(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setInterview(result.data);
    setCurrentIndex(pickNextIndex(result.data));
    navigate(`/round/mock/${encodeURIComponent(result.data.id)}`, { replace: true });
  }, [domain, interviewType, level, loading, navigate, overview?.activeInterviewId, persona]);

  const handleSaveHistoryInterview = useCallback(async (historyItem: MockInterviewHistoryItem) => {
    if (historySaveId === historyItem.id) return;
    setHistorySaveId(historyItem.id);
    const result = await saveMockInterview(historyItem.id, true);
    setHistorySaveId(null);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setOverview((current) => current ? {
      ...current,
      history: current.history.map((item) => item.id === historyItem.id ? { ...item, savedAt: result.data.savedAt } : item),
    } : current);
  }, [historySaveId]);

  const openHistoryInterview = useCallback((historyItem: MockInterviewHistoryItem) => {
    if (historyItem.status === 'completed') {
      navigate(`/results/mock/${encodeURIComponent(historyItem.id)}`);
      return;
    }
    navigate(`/round/mock/${encodeURIComponent(historyItem.id)}`);
  }, [navigate]);

  if (!domain) {
    return (
      <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
        <section className="surface-card">
          <p className="text-body-md text-red-700">Choose your interview domain in onboarding before opening mock interview.</p>
        </section>
      </div>
    );
  }

  if (!interviewId && !interview && !launchFlowStarted) {
    return (
      <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-12">
        <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
        <main className="relative z-10 mx-auto w-full max-w-6xl space-y-6">
          <section className="surface-card">
            <p className="text-ui-label tracking-[0.2em] text-blueprint-muted">MOCK INTERVIEW</p>
            <h1 className="mt-3 text-display-xl text-primary">Practice a realistic mock interview for {domainLabel}.</h1>
            <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
              Start from a clean landing page, then continue into the existing setup flow for level, interview type, and interviewer persona.
            </p>
            {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => { setLaunchFlowStarted(true); setError(null); }} className="rounded-full bg-primary px-6 py-3 text-ui-label text-white hover:bg-[#303031]">
                {overview?.activeInterviewId ? 'Start New Mock Interview' : 'Start Mock Interview'}
              </button>
              {overview?.activeInterviewId ? (
                <button type="button" onClick={() => navigate(`/round/mock/${encodeURIComponent(overview.activeInterviewId!)}`)} className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]">
                  Resume Active Interview
                </button>
              ) : null}
            </div>
          </section>

          <section className="surface-card">
            <div className="flex items-center gap-3">
              <History size={18} className="text-blueprint-muted" />
              <div>
                <p className="text-ui-label text-blueprint-muted">Session History</p>
                <h2 className="text-headline-md text-primary">Recent mock interviews</h2>
              </div>
            </div>
            {loadingOverview ? <p className="mt-4 text-body-md text-blueprint-muted">Loading mock interview history...</p> : null}
            {!loadingOverview && overviewHistory.length === 0 ? <p className="mt-4 text-body-md text-blueprint-muted">No mock interviews yet. Start one to populate your history.</p> : null}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {overviewHistory.map((item) => {
                const persona = personaMeta(item.persona);
                const typeLabel = TYPES.find((entry) => entry.id === item.interviewType)?.title ?? 'Mock Interview';
                return (
                  <article key={item.id} className="rounded-2xl border border-blueprint-line bg-blueprint-bg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-ui-label text-blueprint-muted">{formatInterviewDate(item.completedAt ?? item.startedAt)}</p>
                        <h3 className="mt-2 text-headline-md text-primary">
                          <button type="button" onClick={() => openHistoryInterview(item)} className="text-left hover:underline">
                            {item.interviewTitle}
                          </button>
                        </h3>
                        <p className="mt-1 text-body-md text-blueprint-muted">{typeLabel} · {item.level} · {persona.name}</p>
                      </div>
                      <span className="rounded-full border border-blueprint-line bg-white px-3 py-1 text-ui-label text-primary">{mockHistoryScoreLabel(item)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => { void handleSaveHistoryInterview(item); }}
                        disabled={historySaveId === item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-card px-4 py-2 text-ui-label text-primary hover:bg-[#f5f3f3] disabled:opacity-60"
                      >
                        {historySaveId === item.id ? <LoaderCircle size={15} className="animate-spin" /> : item.savedAt ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                        {historySaveId === item.id ? 'Saving...' : item.savedAt ? 'Saved' : 'Save'}
                      </button>
                      {item.status === 'completed' ? (
                        <button type="button" onClick={() => navigate(`/results/mock/${encodeURIComponent(item.id)}`)} className="rounded-full bg-primary px-4 py-2 text-ui-label text-white hover:bg-[#303031]">
                          View Results
                        </button>
                      ) : (
                        <button type="button" onClick={() => navigate(`/round/mock/${encodeURIComponent(item.id)}`)} className="rounded-full bg-primary px-4 py-2 text-ui-label text-white hover:bg-[#303031]">
                          Resume
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!interviewId && launchFlowStarted && !domainConfirmed) {
    return <RoundDomainGate roundTitle="MOCK INTERVIEW" domain={domain} subject="mock interviews" onConfirmed={() => setDomainConfirmed(true)} />;
  }

  if (!interviewId && !interview) {
    return (
      <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-12">
        <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
        {loading ? (
          <div className="fixed inset-0 z-80 flex items-center justify-center bg-background/90 px-4">
            <div className="rounded-2xl border border-blueprint-line bg-card p-7 text-center shadow-2xl">
              <LoaderCircle size={24} className="mx-auto animate-spin text-primary" />
              <h2 className="mt-4 text-headline-md text-primary">Preparing your interviewer...</h2>
              <p className="mt-2 text-body-md text-blueprint-muted">Elapsed: {elapsedLoading}s · estimated 12s</p>
            </div>
          </div>
        ) : null}
        <main className="relative z-10 mx-auto w-full max-w-6xl space-y-6">
          <section className="surface-card">
            <p className="text-ui-label tracking-[0.2em] text-blueprint-muted">MOCK INTERVIEW</p>
            <h1 className="mt-3 text-display-xl text-primary">{domainLabel} mock interview setup</h1>
            {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}
          </section>

          <section className="surface-card">
            <h2 className="text-headline-sm text-primary">Experience Level</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {LEVELS.map((item) => (
                <button key={item.id} type="button" onClick={() => setLevel(item.id)} className={`rounded-xl border p-5 text-left ${level === item.id ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-card text-primary'}`}>
                  <p className="text-headline-sm">{item.title}</p>
                  <p className="mt-2 text-body-md opacity-75">{item.body}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="surface-card">
            <h2 className="text-headline-sm text-primary">Interview Type</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {TYPES.map((item) => (
                <button key={item.id} type="button" onClick={() => setInterviewType(item.id)} className={`rounded-xl border p-5 text-left ${interviewType === item.id ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-card text-primary'}`}>
                  <p className="text-headline-sm">{item.title}</p>
                  <p className="mt-2 text-body-md opacity-75">{item.body}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="surface-card">
            <h2 className="text-headline-sm text-primary">Interviewer Persona</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {PERSONAS.map((item) => (
                <button key={item.id} type="button" onClick={() => setPersona(item.id)} className={`rounded-xl border p-5 text-left ${persona === item.id ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-card text-primary'}`}>
                  <p className="text-ui-label opacity-70">{item.tag}</p>
                  <h3 className="mt-2 text-headline-sm">{item.name}</h3>
                  <p className="mt-2 text-body-md opacity-75">{item.body}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!setupReady || loading} onClick={() => { void startInterview(); }} className="rounded-full bg-primary px-6 py-3 text-ui-label text-white disabled:cursor-not-allowed disabled:opacity-60">
              {overview?.activeInterviewId ? 'Start New Interview' : 'Start Interview'}
            </button>
            <button type="button" onClick={() => { setLaunchFlowStarted(false); setDomainConfirmed(false); }} className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary">
              Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (loading && !interview) {
    return <div className="min-h-screen bg-background p-8 text-body-md text-blueprint-muted">Loading interview...</div>;
  }

  return (
    <RoundShell
      attemptId={interview?.id}
      feature="mock-interview"
      label={`${interview?.domainLabel ?? domainLabel} Mock Interview`}
      startedAt={interview?.startedAt}
      pausedMs={interview?.pausedMs ?? 0}
      counter={`Q${Math.min(currentIndex + 1, interview?.questions.length || MOCK_INTERVIEW_QUESTION_COUNT)} / ${interview?.questions.length || MOCK_INTERVIEW_QUESTION_COUNT}`}
      timerLimitSeconds={(interview?.durationMinutes ?? MOCK_TOTAL_DURATION_MINUTES) * 60}
      onEndEarly={() => { void finishInterview(); }}
      onMaxVisibilityLeaves={() => { void finishInterview(); }}
      kickOutResultsPath={interview ? `/results/mock/${encodeURIComponent(interview.id)}` : undefined}
      kickOutTopic={interview?.interviewTitle}
    >
      <div className="min-h-[calc(100vh-72px)] bg-background px-4 py-6 sm:px-8 lg:px-12">
        <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
        {finishStage !== 'idle' ? (
          <div className="fixed inset-0 z-90 flex items-center justify-center bg-background/90 px-4">
            <div className="rounded-2xl border border-blueprint-line bg-card p-7 text-center shadow-2xl">
              {finishStage === 'complete' ? (
                <>
                  <p className="text-ui-label text-blueprint-muted">Interview complete</p>
                  <h2 className="mt-4 text-headline-md text-primary">Interview complete</h2>
                  <p className="mt-2 text-body-md text-blueprint-muted">Total time taken: {formatElapsedDuration(completedTimeTakenSeconds)}</p>
                </>
              ) : (
                <>
                  <LoaderCircle size={24} className="mx-auto animate-spin text-primary" />
                  <h2 className="mt-4 text-headline-md text-primary">Generating your assessment...</h2>
                  <p className="mt-2 text-body-md text-blueprint-muted">Elapsed: {elapsedLoading}s</p>
                </>
              )}
            </div>
          </div>
        ) : null}
        {toastMessage ? (
          <div className="fixed bottom-6 left-1/2 z-95 -translate-x-1/2 rounded-full border border-blueprint-line bg-card px-5 py-3 text-ui-label text-primary shadow-xl">
            {toastMessage}
          </div>
        ) : null}
        <main className="relative z-10 mx-auto w-full max-w-5xl space-y-5">
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}
          <section className="surface-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-ui-label ${questionTypeBadgeClass(question?.type)}`}>{questionTypeLabel(question?.type)}</span>
                  <span className="rounded-full border border-blueprint-line bg-blueprint-bg px-3 py-1 text-ui-label text-blueprint-muted">{answeredCount}/{MOCK_INTERVIEW_QUESTION_COUNT} answered</span>
                </div>
                <p className="mt-3 text-ui-label text-blueprint-muted">{meta.name} · {meta.tag}</p>
                <p className="mt-2 text-body-md text-blueprint-muted">{phase === 'reading' ? 'Take mental notes' : phase === 'submitting' ? 'Recording your answer' : 'Answer window is live'}</p>
                <h1 className={`mt-3 text-headline-lg text-primary transition-opacity duration-300 ${questionVisible ? 'opacity-100' : 'opacity-0'}`}>{question?.question ?? 'Loading question...'}</h1>
              </div>
              {phase === 'reading' ? (
                <div className="rounded-2xl border border-blueprint-line bg-blueprint-bg px-5 py-4 text-center">
                  <p className="text-ui-label text-blueprint-muted">Reading Phase</p>
                  <p className="mt-2 font-serif text-[clamp(2.75rem,8vw,4.5rem)] leading-none text-primary"><span ref={readingCountdownRef}>{MOCK_READING_PHASE_SECONDS}</span></p>
                  <p className="mt-2 text-body-sm text-blueprint-muted">Answer unlocks automatically.</p>
                </div>
              ) : (
                <div ref={answerTimerShellRef} className="rounded-2xl border border-blueprint-line bg-blueprint-bg px-5 py-4 text-center transition-all">
                  <p className="text-ui-label">Answer Phase</p>
                  <p className="mt-2 font-serif text-[clamp(2.75rem,8vw,4.5rem)] leading-none"><span ref={answerCountdownRef}>{formatCountdown(MOCK_ANSWER_PHASE_SECONDS)}</span></p>
                  <p className="mt-2 text-body-sm opacity-80">Auto-submits at 0:00</p>
                </div>
              )}
            </div>
          </section>

          <section className="surface-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-ui-label text-blueprint-muted">
                  {phase === 'reading'
                    ? <>Read the question carefully. Answer unlocks in <span ref={readingUnlockRef}>{MOCK_READING_PHASE_SECONDS}</span>s.</>
                    : phase === 'answering'
                      ? 'Answer the question now. Submit early or let the timer auto-record what you have.'
                      : 'Recording your answer...'}
                </p>
                {phase === 'answering' ? (
                  <div className="mt-3 inline-flex items-center gap-3 rounded-full border border-blueprint-line bg-blueprint-bg px-4 py-2 text-ui-label text-primary">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">{meta.name[0]}</span>
                    <span>{meta.name}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="relative mt-4">
              <textarea
                value={draft}
                onChange={(event) => {
                  draftRef.current = event.target.value;
                  setDraft(event.target.value);
                }}
                disabled={!question || phase !== 'answering' || submitting}
                className="min-h-72 w-full resize-none rounded-xl border border-blueprint-line bg-blueprint-bg p-4 text-body-md text-primary outline-none transition-opacity focus:border-primary disabled:opacity-60"
                placeholder="Answer like you would in a real interview. Name tradeoffs, examples, and validation."
              />
              {phase === 'reading' ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-dashed border-blueprint-line bg-card/80 px-6 text-center backdrop-blur-[1px]">
                  <div>
                    <p className="text-ui-label text-blueprint-muted">Read the question carefully.</p>
                    <p className="mt-2 text-body-md text-primary">Answer unlocks in <span ref={readingOverlayCountdownRef}>{MOCK_READING_PHASE_SECONDS}</span>s.</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <button
                  type="button"
                  disabled={phase !== 'answering' || submitting || !voiceSupported}
                  onClick={() => {
                    if (listening) {
                      autoVoiceAllowedRef.current = false;
                      stopListening();
                      return;
                    }
                    autoVoiceAllowedRef.current = true;
                    startListening();
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-ui-label ${phase === 'answering' && voiceSupported ? 'border-blueprint-line text-primary' : 'border-blueprint-line text-blueprint-muted opacity-60'}`}
                >
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                  {listening ? 'Listening live' : 'Voice input'}
                </button>
                {phase === 'answering' && listening ? (
                  <button
                    type="button"
                    onClick={() => {
                      autoVoiceAllowedRef.current = false;
                      stopListening();
                    }}
                    className="mt-2 block text-sm text-blueprint-muted underline underline-offset-2"
                  >
                    Stop and type instead
                  </button>
                ) : phase === 'answering' && voiceSupported ? (
                  <button
                    type="button"
                    onClick={() => {
                      autoVoiceAllowedRef.current = true;
                      startListening();
                    }}
                    className="mt-2 block text-sm text-blueprint-muted underline underline-offset-2"
                  >
                    Start voice input again
                  </button>
                ) : phase === 'submitting' ? (
                  <p className="mt-2 text-sm text-blueprint-muted">Your answer is being recorded now.</p>
                ) : (
                  <p className="mt-2 text-sm text-blueprint-muted">The microphone unlocks after the reading phase.</p>
                )}
              </div>
              <button
                type="button"
                disabled={phase !== 'answering' || submitting}
                onClick={() => { void submitAnswer(); }}
                className="rounded-full bg-primary px-6 py-3 text-ui-label text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Recording...' : 'Submit Answer'}
              </button>
            </div>
          </section>
        </main>
      </div>
    </RoundShell>
  );
}
