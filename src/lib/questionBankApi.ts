import type { BankQuestion, QuestionType } from './questionBank';

export type QuestionStatsItem = {
  id: string;
  label: string;
  total: number;
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
  type?: QuestionType | 'all';
  search?: string;
  faangOnly?: boolean;
  limit?: number;
}): Promise<ApiResult<BankQuestion[]>> {
  const params = new URLSearchParams();
  if (filters.domain) params.set('domain', filters.domain);
  if (filters.type) params.set('type', filters.type);
  if (filters.search) params.set('search', filters.search);
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
  if (filters.faangOnly) params.set('faangOnly', 'true');
  const result = await requestJson<{ questions: BankQuestion[]; totalReturned: number }>(`/api/questions?${params.toString()}`);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.questions };
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

export async function fetchLatestRoundAttempt(roundType: string) {
  const result = await requestJson<{ attempt: StoredRoundAttempt }>(`/api/round-attempts/latest/${encodeURIComponent(roundType)}`);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.attempt };
}