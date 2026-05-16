import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, LoaderCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import RoundShell from '../components/RoundShell';
import {
  completePracticeSession,
  fetchPracticeSession,
  isPracticeAnswerCorrect,
  savePracticeSessionAnswers,
  type PracticeSession,
  type PracticeSessionAnswer,
} from '../lib/practiceSessions';
import { readLocalDraft, saveLocalDraft } from '../lib/roundRuntime';

type AnswerMap = Record<string, PracticeSessionAnswer>;

type LocalPracticeDraft = {
  answers: PracticeSessionAnswer[];
  currentQuestionIndex: number;
};

function toAnswerMap(answers: PracticeSessionAnswer[]) {
  return Object.fromEntries(answers.map((answer) => [answer.questionId, answer])) as AnswerMap;
}

function toAnswerList(answerMap: AnswerMap) {
  return Object.values(answerMap).sort((left, right) => left.confirmedAt.localeCompare(right.confirmedAt));
}

export default function PracticeRound() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const sessionId = String(params.sessionId ?? '').trim();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [answerMap, setAnswerMap] = useState<AnswerMap>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timerAlertOpen, setTimerAlertOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  const currentQuestion = session?.questions[currentQuestionIndex] ?? null;
  const confirmedAnswer = currentQuestion ? answerMap[currentQuestion.id]?.answer ?? '' : '';
  const isConfirmed = Boolean(currentQuestion && answerMap[currentQuestion.id]);
  const answeredCount = Object.keys(answerMap).length;

  useEffect(() => {
    if (!sessionId) {
      setError('Practice session not found.');
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    void fetchPracticeSession(sessionId).then((result) => {
      if (ignore) return;
      setLoading(false);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      if (result.data.status === 'completed') {
        navigate(`/results/practice/${result.data.id}`, { replace: true });
        return;
      }

      const localDraft = readLocalDraft<LocalPracticeDraft>('practice-session', sessionId);
      const startingAnswers = localDraft?.payload.answers.length ? localDraft.payload.answers : result.data.answers;
      setSession(result.data);
      try {
        window.localStorage.setItem('repoid-active-practice-session', result.data.id);
        setTimerAlertOpen(window.localStorage.getItem(`repoid-practice-timer-started:${result.data.id}`) !== 'true');
      } catch {
        setTimerAlertOpen(true);
      }
      setAnswerMap(toAnswerMap(startingAnswers));
      setCurrentQuestionIndex(Math.min(localDraft?.payload.currentQuestionIndex ?? 0, Math.max(result.data.questions.length - 1, 0)));
    });

    return () => {
      ignore = true;
    };
  }, [navigate, sessionId]);

  useEffect(() => {
    if (!currentQuestion) return;
    setDraftAnswer(answerMap[currentQuestion.id]?.answer ?? '');
  }, [answerMap, currentQuestion]);

  useEffect(() => {
    if (!sessionId) return;
    saveLocalDraft('practice-session', sessionId, {
      answers: toAnswerList(answerMap),
      currentQuestionIndex,
    } satisfies LocalPracticeDraft);
  }, [answerMap, currentQuestionIndex, sessionId]);

  const currentIsCorrect = useMemo(() => {
    if (!currentQuestion || !confirmedAnswer) return false;
    return isPracticeAnswerCorrect(currentQuestion, confirmedAnswer);
  }, [confirmedAnswer, currentQuestion]);

  const persistAnswers = async (nextAnswers: AnswerMap) => {
    setSaving(true);
    const result = await savePracticeSessionAnswers(sessionId, toAnswerList(nextAnswers));
    setSaving(false);
    if (result.ok === false) {
      setError(result.error);
    }
  };

  const handleConfirmAnswer = async () => {
    if (!currentQuestion || !draftAnswer.trim() || saving) return;
    setError(null);
    const nextAnswer = {
      questionId: currentQuestion.id,
      answer: draftAnswer.trim(),
      confirmedAt: new Date().toISOString(),
    } satisfies PracticeSessionAnswer;
    const nextAnswers = {
      ...answerMap,
      [currentQuestion.id]: nextAnswer,
    };
    setAnswerMap(nextAnswers);
    await persistAnswers(nextAnswers);
  };

  const handleCompleteSession = async () => {
    if (!session || submitting) return;
    setSubmitConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    const timeSpentSeconds = Math.max(0, Math.round((Date.now() - new Date(session.generatedAt).getTime()) / 1000));
    const result = await completePracticeSession(session.id, {
      answers: toAnswerList(answerMap),
      timeSpentSeconds,
    });
    setSubmitting(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    try {
      window.localStorage.removeItem('repoid-active-practice-session');
      window.localStorage.removeItem(`repoid-round-leaves:practice-session:${session.id}`);
    } catch {
      // Ignore local cleanup failures.
    }
    navigate(`/results/practice/${result.data.id}`, { replace: true });
  };

  useEffect(() => {
    if (!session || submitting) return;
    try {
      const leaveCount = Number(window.localStorage.getItem(`repoid-round-leaves:practice-session:${session.id}`) ?? 0);
      if (leaveCount >= 5) {
        void handleCompleteSession();
      }
    } catch {
      // If localStorage cannot be read, keep the server-backed session resumable.
    }
  }, [session, submitting]);

  const startTimerAlert = () => {
    if (!session) return;
    try {
      window.localStorage.setItem(`repoid-practice-timer-started:${session.id}`, 'true');
    } catch {
      // The modal is only a local acknowledgement.
    }
    setTimerAlertOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-3 rounded-full border border-blueprint-line bg-card px-5 py-3 text-body-md text-primary">
          <LoaderCircle size={18} className="animate-spin" /> Loading practice session...
        </div>
      </div>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-2xl border border-blueprint-line bg-card p-6 text-center shadow-xl">
          <p className="text-ui-label text-blueprint-muted">Practice Sessions</p>
          <h1 className="mt-2 text-headline-md text-primary not-italic">{error ?? 'This practice session is unavailable.'}</h1>
          <button type="button" onClick={() => navigate('/practice-tracks')} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">
            Back to Practice Tracks
          </button>
        </div>
      </div>
    );
  }

  if (timerAlertOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-blueprint-line bg-card p-6 text-center shadow-2xl">
          <p className="text-ui-label text-blueprint-muted">Timer Start Alert</p>
          <h1 className="mt-2 text-headline-md text-primary not-italic">Your practice timer is running.</h1>
          <p className="mt-3 text-body-md text-blueprint-muted">
            Closing or switching away will keep the timer active. Your answers and question position are saved, but leaving 5 times will end the practice round and send you to results.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => navigate(`/practice-tracks?search=${encodeURIComponent(session.topic)}`)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary">
              Go Back
            </button>
            <button type="button" onClick={startTimerAlert} className="rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">
              Start Timer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RoundShell
      attemptId={session.id}
      feature="practice-session"
      label={`${session.domainLabel} Practice`}
      startedAt={session.generatedAt}
      counter={`Q${currentQuestionIndex + 1} of ${session.totalQuestions}`}
      onEndEarly={() => { void handleCompleteSession(); }}
      onMaxVisibilityLeaves={() => { void handleCompleteSession(); }}
    >
      <div className="mx-auto w-full max-w-360 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-blueprint-line bg-card p-5 shadow-[0_22px_44px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-4 border-b border-blueprint-line pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-ui-label text-blueprint-muted">Topic Session</p>
              <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] leading-tight text-primary">{session.topic}</h1>
              <p className="mt-3 max-w-3xl text-body-md text-blueprint-muted">
                Confirm each answer when ready, move freely between questions, and submit whenever you want your score.
              </p>
            </div>
            <div className="rounded-2xl border border-blueprint-line bg-[#fbf9f9] px-4 py-3 text-right">
              <p className="text-ui-label text-blueprint-muted">Answered</p>
              <p className="mt-1 text-headline-md text-primary not-italic">{answeredCount}/{session.totalQuestions}</p>
            </div>
          </div>

          {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {session.questions.map((question, index) => {
              const answered = Boolean(answerMap[question.id]);
              const answer = answerMap[question.id]?.answer ?? '';
              const answeredCorrectly = answered && isPracticeAnswerCorrect(question, answer);
              const active = currentQuestion.id === question.id;
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-ui-label transition-colors ${
                    active
                      ? 'border-primary bg-primary text-white'
                      : answered
                        ? answeredCorrectly
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-red-300 bg-red-50 text-red-700'
                        : 'border-blueprint-line bg-white text-blueprint-muted'
                  }`}
                  aria-label={`Go to question ${index + 1}`}
                >
                  {answered ? <CheckCircle2 size={15} /> : <Circle size={14} />}
                </button>
              );
            })}
          </div>

          <article className="mt-6 rounded-3xl border border-blueprint-line bg-[#fbf9f9] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blueprint-line bg-white px-3 py-1 text-ui-label text-blueprint-muted">
                {currentQuestion.type === 'fill-blank' ? 'FILL BLANK' : 'MCQ'}
              </span>
              <span className="rounded-full border border-blueprint-line bg-white px-3 py-1 text-ui-label text-blueprint-muted">
                {currentQuestion.difficulty.toUpperCase()}
              </span>
            </div>

            <h2 className="mt-5 font-serif text-[clamp(1.7rem,2.8vw,2.5rem)] leading-tight text-primary">{currentQuestion.question}</h2>

            {currentQuestion.type === 'mcq' ? (
              <div className="mt-6 grid gap-3">
                {(currentQuestion.options ?? []).map((option) => {
                  const selected = draftAnswer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isConfirmed}
                      onClick={() => setDraftAnswer(option)}
                      className={`rounded-2xl border p-4 text-left text-body-md transition-colors ${
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-blueprint-line bg-white text-primary hover:bg-[#f5f3f3]'
                      } ${isConfirmed ? 'cursor-not-allowed' : ''}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-blueprint-line bg-white p-4">
                <label className="text-ui-label text-blueprint-muted" htmlFor="practice-fill-answer">Enter the missing term or phrase</label>
                <input
                  id="practice-fill-answer"
                  value={draftAnswer}
                  disabled={isConfirmed}
                  onChange={(event) => setDraftAnswer(event.target.value)}
                  placeholder="Type your answer"
                  className="mt-3 w-full border-0 bg-transparent text-body-lg text-primary outline-none"
                />
              </div>
            )}

            {isConfirmed ? (
              <div className={`mt-6 rounded-2xl border px-4 py-4 ${currentIsCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-ui-label ${currentIsCorrect ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                    {currentIsCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                  {!currentIsCorrect ? (
                    <span className="text-body-md text-primary">Correct answer: {currentQuestion.correctAnswer}</span>
                  ) : null}
                </div>
                <p className="mt-3 text-body-md text-primary">{currentQuestion.explanation || 'Explanation unavailable for this question.'}</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 border-t border-blueprint-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                  className="inline-flex items-center gap-2 rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  type="button"
                  disabled={currentQuestionIndex === session.questions.length - 1}
                  onClick={() => setCurrentQuestionIndex((current) => Math.min(session.questions.length - 1, current + 1))}
                  className="inline-flex items-center gap-2 rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex gap-3">
                {!isConfirmed ? (
                  <button
                    type="button"
                    disabled={!draftAnswer.trim() || saving}
                    onClick={() => { void handleConfirmAnswer(); }}
                    className="rounded-full bg-primary px-6 py-2.5 text-ui-label text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Confirm Answer'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setSubmitConfirmOpen(true)}
                  className="rounded-full border border-primary px-6 py-2.5 text-ui-label text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : currentQuestionIndex === session.questions.length - 1 ? 'End Session & See Results' : answeredCount === session.totalQuestions ? 'Submit Session' : 'End Session'}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
      {submitConfirmOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-blueprint-line bg-card p-6 shadow-2xl">
            <p className="text-ui-label text-blueprint-muted">End Session</p>
            <h2 className="mt-2 text-headline-md text-primary not-italic">Submit and see results?</h2>
            <p className="mt-2 text-body-md text-blueprint-muted">Your current confirmed answers will be evaluated immediately.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSubmitConfirmOpen(false)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary">Stay</button>
              <button type="button" onClick={() => { void handleCompleteSession(); }} className="rounded-full bg-primary px-5 py-2.5 text-ui-label text-white">End Session</button>
            </div>
          </div>
        </div>
      ) : null}
    </RoundShell>
  );
}
