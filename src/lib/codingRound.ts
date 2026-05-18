export type CodingDifficulty = 'easy' | 'medium' | 'hard';
export type CodingVerdict = 'pass' | 'needs-work' | 'fail';
export type CodingLanguage = 'typescript' | 'javascript' | 'python' | 'sql' | 'bash';

export type CodingExample = {
  input: string;
  output: string;
  explanation: string;
};

export type CodingProblem = {
  id: string;
  title: string;
  domain: string;
  difficulty: CodingDifficulty;
  language: CodingLanguage;
  starterCode: string;
  problemStatement: string;
  requirements: string[];
  examples: CodingExample[];
  constraints: string[];
  evaluationCriteria: string[];
};

export type CodingEvaluation = {
  score: number;
  verdict: CodingVerdict;
  correctness: string;
  codeQuality: string;
  edgeCases: string;
  bestPractices?: string;
  dimensionScores?: {
    correctness: number;
    codeQuality: number;
    edgeCases: number;
    bestPractices: number;
  } | null;
  improvements: string[];
  modelSolutionSketch: string;
  modelSolutionCode?: string;
};

export type CodingAttempt = {
  id: string;
  problem: CodingProblem;
  status: string;
  code: string;
  notes: string;
  language: CodingLanguage;
  startedAt: string;
  durationMinutes: number;
  submittedAt: string | null;
  score: number | null;
  timeSpentSeconds: number | null;
  savedAt?: string | null;
  scratchNotes?: string;
  evaluation: CodingEvaluation | null;
  aiUnavailable: boolean;
  evaluationError: string | null;
  summary: string;
  focusAreas: string[];
  nextSteps: string[];
};

export type CodingOverview = {
  activeAttemptId: string | null;
  suggestedFromDifficulty: CodingDifficulty | null;
  suggestedDifficulty: CodingDifficulty | null;
  suggestionMessage: string | null;
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

export async function fetchCodingOverview(domain: string): Promise<ApiResult<CodingOverview>> {
  return requestJson<CodingOverview>(`/api/coding/overview?domain=${encodeURIComponent(domain)}`);
}

export async function generateCodingAttempt(payload: { domain: string; difficulty: CodingDifficulty; forceNew?: boolean }): Promise<ApiResult<CodingAttempt>> {
  const result = await requestJson<{ attempt: CodingAttempt; resumed?: boolean }>('/api/coding/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.attempt };
}

export async function fetchCodingAttempt(attemptId: string): Promise<ApiResult<CodingAttempt>> {
  const result = await requestJson<{ attempt: CodingAttempt }>(`/api/coding/attempts/${encodeURIComponent(attemptId)}`);
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.attempt };
}

export async function fetchCodingStarterCode(
  problemId: string,
  payload: { language: CodingLanguage; domain: string },
): Promise<ApiResult<string>> {
  const result = await requestJson<{ starterCode: string }>(`/api/coding/${encodeURIComponent(problemId)}/starter-code`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.starterCode };
}

export async function saveCodingAttempt(
  attemptId: string,
  payload: { saved?: boolean; scratchNotes?: string },
): Promise<ApiResult<{ savedAt: string | null; scratchNotes?: string }>> {
  return requestJson<{ savedAt: string | null; scratchNotes?: string }>(`/api/coding/${encodeURIComponent(attemptId)}/save`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchCodingHistory(domain: string, difficulty?: CodingDifficulty): Promise<ApiResult<CodingAttempt[]>> {
  const params = new URLSearchParams();
  params.set('domain', domain);
  if (difficulty) params.set('difficulty', difficulty);
  const result = await requestJson<{ attempts: CodingAttempt[] }>(`/api/coding/history?${params.toString()}`);
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.attempts };
}

export async function submitCodingAttempt(
  attemptId: string,
  payload: {
    code: string;
    notes: string;
    timeSpentSeconds?: number;
    difficulty: CodingDifficulty;
    domain: string;
    language: CodingLanguage;
  },
): Promise<ApiResult<CodingAttempt>> {
  const result = await requestJson<{ attempt: CodingAttempt }>(`/api/coding/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.attempt };
}
