import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoundGuard from '../components/RoundGuard';
import RoundShell from '../components/RoundShell';
import { DOMAIN_LABELS } from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';
import {
  requestRoundFeedback,
  startRoundAttempt,
  submitRoundAttempt,
  type RoundFeedback,
  type StoredRoundAttempt,
} from '../lib/questionBankApi';
import { saveLocalDraft, saveServerDraft } from '../lib/roundRuntime';
import { View } from '../App';

interface TerminalPageProps {
  onViewChange: (view: View) => void;
}

const PERSONAS = [
  { id: 'Supportive Mentor', name: 'Alex', style: 'supportive', note: 'Encouraging, specific, and calm.' },
  { id: 'Skeptical Senior Engineer', name: 'Jordan', style: 'technical', note: 'Pushes for depth and precision.' },
  { id: 'Startup CTO', name: 'Sam', style: 'pressure', note: 'Direct, pragmatic, and impact-focused.' },
];

export default function TerminalPage(_props: TerminalPageProps) {
  const navigate = useNavigate();
  const workspace = usePrepWorkspace();
  const [attempt, setAttempt] = useState<StoredRoundAttempt | null>(null);
  const [persona, setPersona] = useState(PERSONAS[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [followUps, setFollowUps] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, RoundFeedback>>({});
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = attempt?.questions ?? [];
  const question = questions[currentIndex] ?? null;
  const domainLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Selected Domain';
  const submittedCurrent = Boolean(question && answers[question.id]);
  const isLastQuestion = currentIndex === questions.length - 1;
  const voiceSupported = typeof window !== 'undefined'
    && window.isSecureContext
    && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startAttempt = useCallback(async () => {
    if (attempt || loadingAttempt) return;
    setLoadingAttempt(true);
    setError(null);
    const result = await startRoundAttempt({
      roundType: 'mock-interview',
      questionType: 'mock',
      domain: workspace.selections.domain,
      limit: 8,
      durationMinutes: 35,
    });
    setLoadingAttempt(false);
    if ('error' in result) throw new Error(result.error);
    setAttempt(result.data);
  }, [attempt, loadingAttempt, workspace.selections.domain]);

  const submitAnswer = async () => {
    if (!attempt || !question || !draft.trim() || feedbackLoading) return;
    setFeedbackLoading(true);
    setError(null);
    const result = await requestRoundFeedback(attempt.id, {
      questionId: question.id,
      answer: draft,
      mode: 'mock',
      persona,
    });
    setFeedbackLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAnswers((current) => ({ ...current, [question.id]: draft }));
    setFeedback((current) => ({ ...current, [question.id]: result.data }));
    const payload = { currentIndex, answers: { ...answers, [question.id]: draft }, followUps, feedback: { ...feedback, [question.id]: result.data } };
    saveLocalDraft('mock-interview', attempt.id, payload);
    void saveServerDraft('mock-interview', attempt.id, payload);
  };

  const finishRound = useCallback(async (autoSubmitted = false) => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    const currentDraft = question && !answers[question.id] && draft ? { ...answers, [question.id]: draft } : answers;
    const result = await submitRoundAttempt(attempt.id, {
      answers: questions.map((item) => ({
        questionId: item.id,
        selectedAnswer: currentDraft[item.id] ?? null,
        notes: JSON.stringify({
          answer: currentDraft[item.id] ?? null,
          followUpQuestion: feedback[item.id]?.followUpQuestion ?? null,
          followUpAnswer: followUps[item.id] ?? null,
        }),
      })),
      autoSubmitted,
      timeSpentSeconds: attempt.durationMinutes * 60,
    });
    setSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAttempt(result.data);
    if (!autoSubmitted) navigate('/results/mock-interview');
  }, [answers, attempt, draft, navigate, question, questions, submitting]);

  const advance = () => {
    if (!submittedCurrent) return;
    if (isLastQuestion) {
      void finishRound(false);
      return;
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setDraft(answers[questions[nextIndex]?.id] ?? '');
    setFollowUpDraft(followUps[questions[nextIndex]?.id] ?? '');
  };

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-8 lg:px-12">
      <RoundGuard roundName="Mock Interview Round" durationMinutes={35} resultsPath="/results/mock-interview" onStart={startAttempt} onExpire={() => finishRound(true)}>
        {({ formattedTime, inputsLocked }) => (
          <RoundShell attemptId={attempt?.id} feature="mock-interview" label={`${domainLabel} Mock Interview`} startedAt={attempt?.startedAt} counter={`Question ${currentIndex + 1} of ${questions.length || 8}`} onEndEarly={() => { void finishRound(false); }}>
            <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
            <main className="relative z-10 mx-auto flex w-full max-w-320 flex-col gap-5">
              <header className="surface-card-compact flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-ui-label text-blueprint-muted">{domainLabel} Mock Interview</p>
                  <h1 className="text-headline-md text-primary not-italic">Six-question simulated interview with live interviewer feedback.</h1>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-blueprint-line bg-[#efeded] px-3 py-1.5 text-ui-label text-primary">
                  <span className="material-symbols-outlined text-[16px]">timer</span>
                  {formattedTime}
                </div>
              </header>

              {!attempt ? (
                <section className="grid gap-4 md:grid-cols-3">
                  {PERSONAS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPersona(item.id)}
                      className={`surface-card text-left transition-colors ${persona === item.id ? 'border-primary bg-primary text-white' : ''}`}
                    >
                      <p className="text-ui-label opacity-70">{item.style}</p>
                      <h2 className="mt-2 text-headline-md not-italic">{item.name}</h2>
                      <p className="mt-2 text-body-md opacity-80">{item.note}</p>
                    </button>
                  ))}
                </section>
              ) : null}

              {loadingAttempt ? <p className="text-body-md text-blueprint-muted">Loading interview set...</p> : null}
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}

              <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <article className="surface-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">Question {currentIndex + 1} of {questions.length || 6}</span>
                    <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">{persona}</span>
                  </div>
                  <h2 className="mt-4 text-headline-md text-primary not-italic">{question?.topic ?? 'Interview prompt'}</h2>
                  <p className="mt-4 text-body-lg text-primary">{question?.questionText ?? 'Start the round to load a domain-specific mock interview prompt.'}</p>
                  <div className="surface-inset mt-5">
                    <p className="text-ui-label text-blueprint-muted">What a strong answer covers</p>
                    <p className="mt-2 text-body-md text-primary">{question?.correctAnswer ?? 'Problem, decision, tradeoff, result, and validation.'}</p>
                  </div>
                  {question && feedback[question.id] ? (
                    <div className="mt-5 rounded-xl border border-blueprint-line bg-card p-4">
                      {feedback[question.id].aiUnavailable ? <p className="mb-3 rounded-lg border border-blueprint-line bg-[#fff7df] px-4 py-3 text-body-md text-primary">AI evaluation temporarily unavailable - your answer is saved and will be re-evaluated shortly.</p> : null}
                      <p className="text-ui-label text-blueprint-muted">Interviewer</p>
                      <p className="mt-2 text-body-md text-primary">{feedback[question.id].spokenResponse}</p>
                      {feedback[question.id].followUpQuestion ? (
                        <div className="mt-4">
                          <p className="text-body-md text-blueprint-muted">{feedback[question.id].followUpQuestion}</p>
                          <textarea
                            value={followUpDraft}
                            onChange={(event) => setFollowUpDraft(event.target.value)}
                            onBlur={() => {
                              setFollowUps((current) => ({ ...current, [question.id]: followUpDraft }));
                              saveLocalDraft('mock-interview', attempt?.id ?? 'pending', { currentIndex, answers, followUps: { ...followUps, [question.id]: followUpDraft }, feedback });
                            }}
                            className="mt-3 min-h-24 w-full resize-none rounded-xl border border-blueprint-line bg-[#fbf9f9] p-3 text-body-md text-primary outline-none focus:border-primary"
                            placeholder="Optional follow-up answer"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>

                <article className="surface-card flex flex-col">
                  <label className="text-ui-label text-blueprint-muted">Your Response</label>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={inputsLocked || !question || submittedCurrent}
                    className="mt-3 min-h-[320px] flex-1 resize-none rounded-xl border border-blueprint-line bg-[#fbf9f9] p-4 text-body-md text-primary outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Write what you said. Include tradeoffs, failure modes, and validation."
                  />
                  <div className="mt-2 flex items-center justify-between text-ui-label text-blueprint-muted">
                    <span>{draft.length} characters</span>
                    {voiceSupported ? <span>Voice mode available</span> : null}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => navigate('/practice-tracks')} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary hover:bg-[#f5f3f3]">
                      Exit
                    </button>
                    {submittedCurrent ? (
                      <button type="button" onClick={advance} className="rounded-full bg-primary px-6 py-2.5 text-ui-label text-white hover:bg-[#303031]">
                        {isLastQuestion ? (submitting ? 'Submitting...' : 'Finish Interview') : 'Next Question'}
                      </button>
                    ) : (
                      <button type="button" disabled={inputsLocked || feedbackLoading || !question || !draft.trim()} onClick={() => { void submitAnswer(); }} className="rounded-full bg-primary px-6 py-2.5 text-ui-label text-white hover:bg-[#303031] disabled:cursor-not-allowed disabled:opacity-60">
                        {feedbackLoading ? 'Interviewer Thinking...' : 'Submit Answer'}
                      </button>
                    )}
                  </div>
                </article>
              </section>
            </main>
          </RoundShell>
        )}
      </RoundGuard>
    </div>
  );
}
