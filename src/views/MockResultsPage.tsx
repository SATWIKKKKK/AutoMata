import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkCheck, ChevronDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { MOCK_INTERVIEW_QUESTION_COUNT, fetchMockInterview, saveMockInterview, type MockInterviewState, type MockQuestionType } from '../lib/mockInterview';

function verdictClass(verdict: string) {
  if (verdict === 'strong-yes') return 'border-emerald-500 bg-emerald-600 text-white';
  if (verdict === 'ready') return 'border-sky-500 bg-sky-600 text-white';
  if (verdict === 'borderline') return 'border-amber-500 bg-amber-600 text-white';
  return 'border-red-500 bg-red-600 text-white';
}

function hasSubmittedMockAnswer(answer: string | null | undefined) {
  return String(answer ?? '').trim().length > 0;
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

function personaName(persona: string) {
  if (persona === 'jordan') return 'Jordan';
  if (persona === 'sam') return 'Sam';
  return 'Alex';
}

export default function MockResultsPage() {
  const navigate = useNavigate();
  const params = useParams<{ interviewId?: string }>();
  const interviewId = String(params.interviewId ?? '').trim();
  const [interview, setInterview] = useState<MockInterviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openReplayId, setOpenReplayId] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) {
      setError('Mock interview id is missing.');
      setLoading(false);
      return;
    }
    let ignore = false;
    void fetchMockInterview(interviewId).then((result) => {
      if (ignore) return;
      setLoading(false);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setInterview(result.data);
      setOpenReplayId(result.data.questions[0]?.id ?? null);
    });
    return () => {
      ignore = true;
    };
  }, [interviewId]);

  const report = interview?.report ?? null;
  const dimensions = useMemo(() => report ? [
    ['Technical Depth', report.technicalDepth],
    ['Communication Clarity', report.communicationClarity],
    ['Design Thinking', report.designThinking],
    ['Behavioral Maturity', report.behavioralMaturity],
  ] : [], [report]);
  const replayItems = useMemo(() => {
    if (!interview) return [];
    return interview.questions.map((question, index) => {
      const response = interview.responses.find((item) => item.questionId === question.id) ?? null;
      return {
        id: question.id,
        index,
        question,
        response,
      };
    });
  }, [interview]);
  const zeroAnswerState = Boolean(report && report.answeredCount === 0 && report.overallScore === 0);
  const persona = personaName(interview?.persona ?? 'alex');

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-6xl space-y-6">
        {loading ? <section className="surface-card"><p className="text-body-md text-blueprint-muted">Loading mock results...</p></section> : null}
        {error ? <section className="surface-card"><p className="text-body-md text-red-700">{error}</p></section> : null}
        {interview && report ? (
          <>
            {report.isPartial ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-ui-label text-amber-700">Partial Assessment - Based on {report.answeredCount}/{MOCK_INTERVIEW_QUESTION_COUNT} questions answered. Complete all questions for a full evaluation.</p>
              </section>
            ) : null}
            <section className="rounded-[28px] border border-blueprint-line bg-card p-6 shadow-[0_24px_48px_rgba(0,0,0,0.06)] sm:p-8">
              <p className="text-ui-label tracking-[0.22em] text-blueprint-muted">MOCK INTERVIEW RESULTS</p>
              <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-display-xl text-primary">{interview.interviewTitle}</h1>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-blueprint-line bg-blueprint-bg px-3 py-1 text-ui-label text-primary">{interview.domainLabel}</span>
                    <span className="rounded-full border border-blueprint-line bg-blueprint-bg px-3 py-1 text-ui-label text-primary">{interview.level}</span>
                    <span className="rounded-full border border-blueprint-line bg-blueprint-bg px-3 py-1 text-ui-label text-primary">{persona}</span>
                    <span className={`rounded-full border px-3 py-1 text-ui-label ${verdictClass(report.readinessVerdict)}`}>{report.readinessVerdict}</span>
                  </div>
                </div>
                {!zeroAnswerState ? (
                  <div className="rounded-[24px] border border-blueprint-line bg-blueprint-bg px-6 py-5 text-center">
                    <p className="text-ui-label text-blueprint-muted">Overall Score</p>
                    <p className="mt-2 font-serif text-[clamp(3rem,8vw,5rem)] leading-none text-primary">{report.overallScore}<span className="text-headline-md text-blueprint-muted">/10</span></p>
                  </div>
                ) : null}
              </div>
              {zeroAnswerState ? (
                <div className="mt-6 rounded-2xl border border-blueprint-line bg-blueprint-bg p-6">
                  <h2 className="text-headline-md text-primary">No answers recorded. Start a new interview to receive an assessment.</h2>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => navigate('/mock-interview')} className="rounded-full bg-primary px-6 py-3 text-ui-label text-white hover:bg-[#303031]">Start New Interview</button>
                    <button type="button" onClick={() => navigate('/dashboard')} className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]">View Dashboard</button>
                  </div>
                </div>
              ) : null}
            </section>

            {!zeroAnswerState ? (
              <>
                <section className="grid gap-4 lg:grid-cols-2">
                  {dimensions.map(([title, body]) => (
                    <article key={title} className="rounded-2xl border border-blueprint-line bg-card p-5">
                      <p className="text-ui-label text-blueprint-muted">{title}</p>
                      <p className="mt-3 text-body-md text-primary">{body}</p>
                    </article>
                  ))}
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <article className="rounded-2xl border border-blueprint-line border-l-4 border-l-[#16a34a] bg-card p-5">
                    <p className="text-ui-label text-[#16a34a]">Top 3 Strengths</p>
                    {report.topThreeStrengths.length ? <ul className="mt-3 space-y-2 text-body-md text-primary">{report.topThreeStrengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-3 text-body-md text-blueprint-muted">No clear strengths were earned in this session.</p>}
                  </article>
                  <article className="rounded-2xl border border-blueprint-line border-l-4 border-l-[#dc2626] bg-card p-5">
                    <p className="text-ui-label text-[#dc2626]">Top 3 Weaknesses</p>
                    <ul className="mt-3 space-y-2 text-body-md text-primary">{report.topThreeWeaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
                  </article>
                </section>

                <section className="rounded-2xl border border-red-200 bg-card p-5">
                  <p className="text-ui-label text-red-700">Critical Gaps</p>
                  <div className="mt-3 flex flex-wrap gap-2">{report.criticalGaps.map((gap) => <span key={gap} className="rounded-full bg-red-600 px-3 py-1 text-ui-label text-white">{gap}</span>)}</div>
                </section>

                <section className="rounded-2xl border border-blueprint-line bg-card p-5">
                  <p className="text-ui-label text-blueprint-muted">Study Plan</p>
                  {report.studyPlan.length ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-160 text-left text-body-md text-primary">
                        <thead className="border-b border-blueprint-line text-ui-label text-blueprint-muted">
                          <tr><th className="py-3">Area</th><th className="py-3">Action</th><th className="py-3">Estimated Days</th></tr>
                        </thead>
                        <tbody>
                          {report.studyPlan.map((item) => (
                            <tr key={`${item.area}-${item.action}`} className="border-b border-blueprint-line/70">
                              <td className="py-3 pr-4">{item.area}</td>
                              <td className="py-3 pr-4">{item.action}</td>
                              <td className="py-3">{item.estimatedDays}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="mt-3 text-body-md text-blueprint-muted">No study plan was generated for this session.</p>}
                </section>

                <section className="rounded-2xl border border-[#d97706] bg-card p-6">
                  <p className="text-ui-label text-[#b45309]">What the hiring committee would say</p>
                  <p className="mt-3 text-body-lg text-primary">{report.hiringPanelSummary}</p>
                </section>
              </>
            ) : null}

            <section className="rounded-2xl border border-blueprint-line bg-card p-5">
              <p className="text-ui-label text-blueprint-muted">Question Replay</p>
              <p className="mt-2 text-body-md text-blueprint-muted">Review exactly what was asked, what you answered, how the interviewer responded, and what score was stored for each question.</p>
              <div className="mt-5 space-y-3">
                {replayItems.map(({ id, index, question, response }) => {
                  const open = openReplayId === id;
                  return (
                    <article key={id} className="overflow-hidden rounded-2xl border border-blueprint-line bg-blueprint-bg">
                      <button
                        type="button"
                        onClick={() => setOpenReplayId((current) => current === id ? null : id)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-ui-label ${questionTypeBadgeClass(question.type)}`}>{questionTypeLabel(question.type)}</span>
                            <span className="rounded-full border border-blueprint-line bg-card px-3 py-1 text-ui-label text-blueprint-muted">Q{index + 1}</span>
                          </div>
                          <h3 className="mt-3 text-headline-sm text-primary">{question.question}</h3>
                        </div>
                        <ChevronDown size={18} className={`shrink-0 text-blueprint-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open ? (
                        <div className="border-t border-blueprint-line px-5 py-5">
                          <div className="grid gap-4 lg:grid-cols-3">
                            <div className="rounded-2xl border border-blueprint-line bg-card p-4 lg:col-span-2">
                              <p className="text-ui-label text-blueprint-muted">Your Answer</p>
                              <p className="mt-3 whitespace-pre-wrap text-body-md text-primary">{response && hasSubmittedMockAnswer(response.answer) ? response.answer : 'Not answered'}</p>
                            </div>
                            <div className="rounded-2xl border border-blueprint-line bg-card p-4">
                              <p className="text-ui-label text-blueprint-muted">Stored Score</p>
                              <p className="mt-3 text-headline-md text-primary">{response?.internalScore ?? 'Not scored'}</p>
                              <p className="mt-3 text-body-sm text-blueprint-muted">{typeof response?.timeSpentSeconds === 'number' ? `${response.timeSpentSeconds}s in answer phase` : 'No recorded answer time'}</p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-2xl border border-blueprint-line bg-card p-4">
                            <p className="text-ui-label text-blueprint-muted">{persona}'s Response</p>
                            <p className="mt-3 whitespace-pre-wrap text-body-md text-primary">{response?.spokenResponse ?? 'No interviewer response was recorded.'}</p>
                          </div>
                          <div className="mt-4 rounded-2xl border border-blueprint-line bg-card p-4">
                            <p className="text-ui-label text-blueprint-muted">What This Response Missed</p>
                            {response?.internalFlags?.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">{response.internalFlags.map((flag) => <span key={flag} className="rounded-full border border-blueprint-line bg-blueprint-bg px-3 py-1 text-ui-label text-primary">{flag}</span>)}</div>
                            ) : <p className="mt-3 text-body-md text-blueprint-muted">No additional flags were stored for this question.</p>}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={saving} onClick={async () => { setSaving(true); await saveMockInterview(interview.id, true); setSaving(false); }} className="inline-flex items-center gap-2 rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3] disabled:opacity-60">
                <BookmarkCheck size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => navigate('/mock-interview')} className="rounded-full bg-primary px-6 py-3 text-ui-label text-white hover:bg-[#303031]">{zeroAnswerState ? 'Start New Interview' : 'Try Another Interview'}</button>
              <button type="button" onClick={() => navigate('/dashboard')} className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary hover:bg-[#f5f3f3]">View Dashboard</button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
