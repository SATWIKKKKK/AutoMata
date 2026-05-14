import type { BankQuestion, QuestionType } from './questionBank';

export type QuestionStatsItem = {
  id: string;
  label: string;
  total: number;
};

export type QuestionListResponse = {
  questions: BankQuestion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type RoundAttemptAnswerInput = {
  questionId: string;
  selectedAnswer?: string | null;
  codeAnswer?: string | null;
  notes?: string | null;
};

export type RoundAttemptDetail = {
  questionId: string;
  topic: string;
  prompt: string;
  submittedAnswer: string | null;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
  score: number;
  observations: string[];
};

export type StoredRoundAttempt = {
  id: string;
  roundType: string;
  questionType: QuestionType;
  domain: string;
  status: string;
  durationMinutes: number;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  timeSpentSeconds: number | null;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string | null;
  summary: string;
  focusAreas: string[];
  nextSteps: string[];
  questions: BankQuestion[];
  answers: RoundAttemptAnswerInput[];
  results: RoundAttemptDetail[];
};

export type RoundFeedback = {
  aiUnavailable?: boolean;
  score: number;
  feedback: string;
  whatWorked: string;
  whatWasMissed: string;
  seniorEngineerWouldHaveSaid?: string;
  spokenResponse?: string;
  followUpQuestion?: string | null;
  internalFlags?: string[];
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
      return { ok: false, error: String(data.error ?? 'Request failed.') };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export async function fetchQuestionStats() {
  const result = await requestJson<{ stats: QuestionStatsItem[] }>('/api/questions/stats');
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.stats };
}

export async function fetchQuestions(filters: {
  domain?: string;
  types?: QuestionType[];
  type?: QuestionType | 'all';
  search?: string;
  faangOnly?: boolean;
  topics?: string[];
  roundTags?: string[];
  page?: number;
  pageSize?: number;
  limit?: number;
}): Promise<ApiResult<QuestionListResponse>> {
  const params = new URLSearchParams();
  if (filters.domain) params.set('domain', filters.domain);
  if (filters.types?.length) params.set('types', filters.types.join(','));
  else if (filters.type) params.set('type', filters.type);
  if (filters.search) params.set('search', filters.search);
  if (filters.topics?.length) params.set('topics', filters.topics.join(','));
  if (filters.roundTags?.length) params.set('roundTags', filters.roundTags.join(','));
  if (typeof filters.page === 'number') params.set('page', String(filters.page));
  if (typeof filters.pageSize === 'number') params.set('pageSize', String(filters.pageSize));
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
  if (filters.faangOnly) params.set('faangOnly', 'true');
  const result = await requestJson<QuestionListResponse & { totalReturned: number }>(`/api/questions?${params.toString()}`);
  if ('error' in result) return { ok: false, error: result.error };
  return {
    ok: true,
    data: {
      questions: result.data.questions,
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
      totalPages: result.data.totalPages,
    },
  };
}

export async function startRoundAttempt(payload: {
  roundType: string;
  questionType: QuestionType;
  domain: string;
  limit: number;
  durationMinutes: number;
}): Promise<ApiResult<StoredRoundAttempt>> {
  const result = await requestJson<{ attempt: StoredRoundAttempt }>('/api/round-attempts/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.attempt };
}

export async function submitRoundAttempt(attemptId: string, payload: {
  answers: RoundAttemptAnswerInput[];
  timeSpentSeconds?: number;
  autoSubmitted?: boolean;
}): Promise<ApiResult<StoredRoundAttempt>> {
  const result = await requestJson<{ attempt: StoredRoundAttempt }>(`/api/round-attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.attempt };
}

export async function requestRoundFeedback(attemptId: string, payload: {
  questionId: string;
  answer: string;
  mode: 'scenario' | 'mock';
  persona?: string;
}): Promise<ApiResult<RoundFeedback>> {
  const result = await requestJson<{ feedback: RoundFeedback }>(`/api/round-attempts/${encodeURIComponent(attemptId)}/feedback`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.feedback };
}

export async function fetchLatestRoundAttempt(roundType: string, domain?: string) {
  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const result = await requestJson<{ attempt: StoredRoundAttempt }>(`/api/round-attempts/latest/${encodeURIComponent(roundType)}${suffix}`);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.attempt };
}

export async function fetchLatestRoundAttemptSummary(domain?: string) {
  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const result = await requestJson<{ attempts: StoredRoundAttempt[] }>(`/api/round-attempts/latest-summary${suffix}`);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.attempts };
}

export async function fetchRoundFocusSummary(attemptId: string): Promise<ApiResult<Array<{ type: string; total: number }>>> {
  const result = await requestJson<{ events: Array<{ type: string; total: number }> }>(`/api/rounds/${encodeURIComponent(attemptId)}/focus-summary`);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.events };
}
