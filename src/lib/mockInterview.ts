export type MockLevel = 'junior' | 'mid' | 'senior';
export type MockInterviewType = 'technical' | 'design' | 'mixed';
export type MockPersona = 'alex' | 'jordan' | 'sam';
export type MockQuestionType = 'technical' | 'design' | 'behavioral' | 'situational';
export type MockReadinessVerdict = 'not-ready' | 'borderline' | 'ready' | 'strong-yes';

export const MOCK_INTERVIEW_QUESTION_COUNT = 3;
export const MOCK_READING_PHASE_SECONDS = 20;
export const MOCK_ANSWER_PHASE_SECONDS = 5 * 60;
export const MOCK_TOTAL_DURATION_MINUTES = 15;

export type MockQuestion = {
  id: string;
  question: string;
  type: MockQuestionType;
  whatWeAreLookingFor: string;
  followUpIfStrong: string;
  followUpIfWeak: string;
};

export type MockResponse = {
  questionId: string;
  answer: string;
  followUpAnswer?: string;
  spokenResponse: string;
  followUpQuestion: string | null;
  internalScore: number | null;
  internalFlags: string[];
  aiUnavailable?: boolean;
  timeSpentSeconds: number | null;
  answeredAt: string;
};

export type MockReport = {
  overallScore: number;
  readinessVerdict: MockReadinessVerdict;
  technicalDepth: string;
  communicationClarity: string;
  designThinking: string;
  behavioralMaturity: string;
  topThreeStrengths: string[];
  topThreeWeaknesses: string[];
  criticalGaps: string[];
  studyPlan: Array<{ area: string; action: string; estimatedDays: number }>;
  hiringPanelSummary: string;
  isPartial: boolean;
  answeredCount: number;
};

export type MockInterviewState = {
  id: string;
  domain: string;
  domainLabel: string;
  level: MockLevel;
  interviewType: MockInterviewType;
  persona: MockPersona;
  interviewTitle: string;
  status: string;
  questions: MockQuestion[];
  responses: MockResponse[];
  currentQuestionIndex: number;
  startedAt: string;
  pausedMs: number;
  durationMinutes: number;
  completedAt: string | null;
  savedAt: string | null;
  report: MockReport | null;
};

export type MockInterviewHistoryItem = {
  id: string;
  domain: string;
  domainLabel: string;
  level: MockLevel;
  interviewType: MockInterviewType;
  persona: MockPersona;
  interviewTitle: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  savedAt: string | null;
  score: number | null;
};

export type MockInterviewOverview = {
  activeInterviewId: string | null;
  history: MockInterviewHistoryItem[];
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; aiUnavailable?: boolean };

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string; aiUnavailable?: boolean };
    if (!response.ok) return { ok: false, error: String(data.error ?? 'Request failed.'), aiUnavailable: Boolean(data.aiUnavailable) };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export async function startMockInterview(payload: { domain: string; level: MockLevel; interviewType: MockInterviewType; persona: MockPersona; forceNew?: boolean }) {
  const result = await requestJson<{ interview: MockInterviewState }>('/api/mock/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.interview };
}

export async function fetchMockOverview(domain: string) {
  return requestJson<MockInterviewOverview>(`/api/mock/overview?domain=${encodeURIComponent(domain)}`);
}

export async function fetchMockInterview(interviewId: string) {
  const result = await requestJson<{ interview: MockInterviewState }>(`/api/mock/${encodeURIComponent(interviewId)}`);
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.interview };
}

export async function respondToMockQuestion(
  interviewId: string,
  payload: { questionId: string; answer: string; followUpAnswer?: string; timeSpentSeconds?: number },
) {
  const result = await requestJson<{ response: MockResponse; interview: MockInterviewState }>(`/api/mock/${encodeURIComponent(interviewId)}/respond`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data };
}

export async function finishMockInterview(interviewId: string) {
  const result = await requestJson<{ interview: MockInterviewState }>(`/api/mock/${encodeURIComponent(interviewId)}/finish`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.interview };
}

export async function saveMockInterview(interviewId: string, saved = true) {
  return requestJson<{ savedAt: string | null }>(`/api/mock/${encodeURIComponent(interviewId)}/save`, {
    method: 'POST',
    body: JSON.stringify({ saved }),
  });
}
