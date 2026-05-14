import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOMAIN_LABELS } from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';
import {
  completeTrackModule,
  evaluateTrackModuleAnswer,
  startPracticeTrack,
  type PracticeTrackModule,
  type PracticeTrackState,
  type PracticeAnswerEvaluation,
} from '../lib/practiceTracks';
import { saveLocalDraft } from '../lib/roundRuntime';

type AnswerMap = Record<string, string>;

function scoreModule(module: PracticeTrackModule, answers: AnswerMap) {
  if (!module.questions.length) return 0;
  const correct = module.questions.reduce((count, question) => {
    const submitted = (answers[question.id] ?? '').trim().toLowerCase();
    const expected = question.correctAnswer.trim().toLowerCase();
    return submitted && (submitted === expected || expected.includes(submitted)) ? count + 1 : count;
  }, 0);
  return Math.round((correct / module.questions.length) * 100);
}

export default function Workflows() {
  const navigate = useNavigate();
  const workspace = usePrepWorkspace();
  const domain = workspace.selections.domain;
  const domainLabel = DOMAIN_LABELS[domain] ?? 'Selected Domain';
  const [track, setTrack] = useState<PracticeTrackState | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [evaluations, setEvaluations] = useState<Record<string, PracticeAnswerEvaluation>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [moduleScore, setModuleScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeModule = useMemo(() => {
    if (!track) return null;
    return track.modules.find((module) => module.moduleKey === selectedKey)
      ?? track.modules.find((module) => module.status === 'active')
      ?? track.modules[0]
      ?? null;
  }, [selectedKey, track]);

  const completedCount = track?.modules.filter((module) => module.status === 'done').length ?? 0;
  const progress = track?.modules.length ? Math.round((completedCount / track.modules.length) * 100) : 0;
  const allAnswered = Boolean(activeModule?.questions.length)
    && activeModule!.questions.every((question) => (answers[question.id] ?? '').trim());
  const currentQuestion = activeModule?.questions[currentQuestionIndex] ?? null;
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] : null;

  const loadTrack = useCallback(async () => {
    if (!domain) {
      setError('Choose your interview domain in onboarding before starting a practice track.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await startPracticeTrack(domain);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setTrack(result.data);
    setSelectedKey((current) => current ?? result.data.modules.find((module) => module.status === 'active')?.moduleKey ?? result.data.modules[0]?.moduleKey ?? null);
  }, [domain]);

  useEffect(() => {
    void loadTrack();
  }, [loadTrack]);

  useEffect(() => {
    setAnswers({});
    setEvaluations({});
    setCurrentQuestionIndex(0);
    setDraftAnswer('');
    setModuleScore(null);
  }, [activeModule?.moduleKey]);

  useEffect(() => {
    if (!track || !activeModule || !currentQuestion) return;
    saveLocalDraft('practice-track', `${track.id}:${activeModule.moduleKey}`, { currentQuestionIndex, draftAnswer, answers, savedAt: new Date().toISOString() });
  }, [activeModule, answers, currentQuestion, currentQuestionIndex, draftAnswer, track]);

  const submitCurrentAnswer = async () => {
    if (!track || !activeModule || !currentQuestion || !draftAnswer.trim() || saving) return;
    setSaving(true);
    const result = await evaluateTrackModuleAnswer(track.id, activeModule.moduleKey, currentQuestion.id, draftAnswer);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAnswers((current) => ({ ...current, [currentQuestion.id]: draftAnswer }));
    setEvaluations((current) => ({ ...current, [currentQuestion.id]: result.data }));
  };

  const submitModule = async () => {
    if (!track || !activeModule || !allAnswered || saving) return;
    const score = scoreModule(activeModule, answers);
    setModuleScore(score);
    setSaving(true);
    const result = await completeTrackModule(track.id, activeModule.moduleKey, score);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setTrack(result.data);
    const next = result.data.modules.find((module) => module.status === 'active');
    if (next) setSelectedKey(next.moduleKey);
  };

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-10 xl:px-14">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto grid w-full max-w-360 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="surface-card">
            <p className="text-ui-label text-blueprint-muted">Practice Tracks</p>
            <h1 className="mt-2 text-headline-lg text-primary">{domainLabel}</h1>
            <div className="mt-5">
              <div className="flex items-center justify-between text-ui-label text-blueprint-muted">
                <span>{completedCount} modules done</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#e4e2e2]">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="surface-inset">
                <p className="text-ui-label text-blueprint-muted">XP</p>
                <p className="mt-1 text-headline-md text-primary not-italic">{completedCount * 120}</p>
              </div>
              <div className="surface-inset">
                <p className="text-ui-label text-blueprint-muted">Streak</p>
                <p className="mt-1 text-headline-md text-primary not-italic">{completedCount ? '1 day' : '0 days'}</p>
              </div>
            </div>
          </section>

          <section className="surface-card space-y-3">
            {loading ? <p className="text-body-md text-blueprint-muted">Loading modules...</p> : null}
            {track?.modules.map((module) => (
              <button
                key={module.moduleKey}
                type="button"
                disabled={module.status === 'locked'}
                onClick={() => setSelectedKey(module.moduleKey)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  activeModule?.moduleKey === module.moduleKey
                    ? 'border-primary bg-primary text-white'
                    : 'border-blueprint-line bg-card text-primary hover:bg-[#f5f3f3] dark:hover:bg-white/5'
                } ${module.status === 'locked' ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {module.status === 'done' ? 'check_circle' : module.status === 'active' ? 'play_circle' : 'lock'}
                </span>
                <span className="min-w-0">
                  <span className="block text-ui-label normal-case">{module.moduleTitle}</span>
                  <span className="mt-1 block text-[12px] opacity-75">
                    {module.score === null ? `${module.questions.length} questions` : `${module.score}% score`}
                  </span>
                </span>
              </button>
            ))}
          </section>
        </aside>

        <section className="space-y-6">
          <header className="border-b border-blueprint-line pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-ui-label text-blueprint-muted">Focused Module</p>
                <h2 className="mt-2 text-display-xl text-primary">{activeModule?.moduleTitle ?? 'Loading track'}</h2>
                <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
                  Answer the curated set, submit the module, and the next module unlocks. Scores below 60% insert a remedial module before the track continues.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => navigate('/scenario-round')} className="rounded-full border border-blueprint-line px-4 py-2 text-ui-label text-primary hover:bg-[#f5f3f3]">
                  Scenario
                </button>
                <button type="button" onClick={() => navigate('/coding-round')} className="rounded-full border border-blueprint-line px-4 py-2 text-ui-label text-primary hover:bg-[#f5f3f3]">
                  Coding
                </button>
                <button type="button" onClick={() => navigate('/mock-interview')} className="rounded-full border border-blueprint-line px-4 py-2 text-ui-label text-primary hover:bg-[#f5f3f3]">
                  Mock
                </button>
              </div>
            </div>
            {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}
            {moduleScore !== null ? (
              <p className="mt-4 rounded-lg border border-blueprint-line bg-card px-4 py-3 text-body-md text-primary">
                Last module score: {moduleScore}%. {moduleScore < 60 ? 'A remedial module has been inserted.' : 'The next module is unlocked.'}
              </p>
            ) : null}
          </header>

          <div className="space-y-4">
            {currentQuestion ? (
              <article key={currentQuestion.id} className="surface-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">Q{currentQuestionIndex + 1} of {activeModule?.questions.length ?? 0}</span>
                  <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">{currentQuestion.type.replace('_', ' ')}</span>
                </div>
                <h3 className="mt-4 text-headline-md text-primary not-italic">{currentQuestion.questionText}</h3>
                {currentQuestion.codeSnippet ? <pre className="mt-4 overflow-x-auto rounded-lg bg-[#1A1A1A] p-4 text-[13px] leading-6 text-[#d4d4d4]"><code>{currentQuestion.codeSnippet}</code></pre> : null}
                <details className="surface-inset mt-4">
                  <summary className="cursor-pointer text-ui-label text-primary">Hint</summary>
                  <p className="mt-2 text-body-md text-blueprint-muted">{currentQuestion.explanation}</p>
                </details>
                {currentQuestion.options?.length ? (
                  <div className="mt-4 grid gap-2">
                    {currentQuestion.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={activeModule.status === 'done' || Boolean(currentEvaluation)}
                        onClick={() => setDraftAnswer(option)}
                        className={`rounded-lg border p-3 text-left text-body-md transition-colors ${
                          draftAnswer === option
                            ? 'border-primary bg-primary text-white'
                            : 'border-blueprint-line bg-card text-primary hover:bg-[#f5f3f3] dark:hover:bg-white/5'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={draftAnswer}
                    disabled={activeModule.status === 'done' || Boolean(currentEvaluation)}
                    onChange={(event) => setDraftAnswer(event.target.value)}
                    className="mt-4 min-h-28 w-full resize-none rounded-xl border border-blueprint-line bg-[#fbf9f9] p-4 text-body-md text-primary outline-none focus:border-primary"
                    placeholder="Write a concise answer."
                  />
                )}
                {currentEvaluation ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {currentEvaluation.aiUnavailable ? <p className="rounded-lg border border-blueprint-line bg-[#fff7df] px-4 py-3 text-body-md text-primary lg:col-span-2">AI evaluation temporarily unavailable - your answer is saved and will be re-evaluated shortly.</p> : null}
                    <div className="surface-inset"><p className="text-ui-label text-blueprint-muted">Score</p><p className="mt-1 text-headline-md text-primary not-italic">{currentEvaluation.score}/10 · {currentEvaluation.verdict}</p></div>
                    <div className="surface-inset"><p className="text-ui-label text-blueprint-muted">What You Got Right</p><p className="mt-2 text-body-md text-primary">{currentEvaluation.whatTheyGotRight}</p></div>
                    <div className="surface-inset"><p className="text-ui-label text-blueprint-muted">What Was Missing</p><p className="mt-2 text-body-md text-primary">{currentEvaluation.whatIsMissing}</p></div>
                    <details className="surface-inset"><summary className="cursor-pointer text-ui-label text-primary">Improved Answer</summary><p className="mt-2 text-body-md text-blueprint-muted">{currentEvaluation.improvedAnswer}</p></details>
                    {currentEvaluation.followUpQuestion ? <div className="surface-inset lg:col-span-2"><p className="text-ui-label text-blueprint-muted">Follow-up</p><p className="mt-2 text-body-md text-primary">{currentEvaluation.followUpQuestion}</p></div> : null}
                  </div>
                ) : null}
              </article>
            ) : null}
          </div>

          <footer className="flex flex-col gap-3 border-t border-blueprint-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-md text-blueprint-muted">
              {activeModule?.status === 'done' ? 'This module is complete.' : `${Object.values(answers).filter(Boolean).length} of ${activeModule?.questions.length ?? 0} answered`}
            </p>
            <div className="flex gap-3">
              {currentQuestionIndex > 0 ? <button type="button" onClick={() => { const next = currentQuestionIndex - 1; setCurrentQuestionIndex(next); setDraftAnswer(activeModule?.questions[next] ? answers[activeModule.questions[next].id] ?? '' : ''); }} className="rounded-full border border-blueprint-line px-5 py-3 text-ui-label text-primary">Back</button> : null}
              {currentEvaluation ? (
                currentQuestionIndex === (activeModule?.questions.length ?? 1) - 1
                  ? <button type="button" disabled={!allAnswered || saving || activeModule?.status === 'done'} onClick={() => { void submitModule(); }} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Submit Module'}</button>
                  : <button type="button" onClick={() => { const next = currentQuestionIndex + 1; setCurrentQuestionIndex(next); setDraftAnswer(activeModule?.questions[next] ? answers[activeModule.questions[next].id] ?? '' : ''); }} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white">Next Question</button>
              ) : (
                <button type="button" disabled={!draftAnswer.trim() || saving || activeModule?.status === 'done'} onClick={() => { void submitCurrentAnswer(); }} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Evaluating...' : 'Submit Answer'}</button>
              )}
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
