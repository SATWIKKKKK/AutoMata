import type { BankQuestion } from './questionBank';

export type TrackModuleStatus = 'locked' | 'active' | 'done';

export type PracticeTrackModule = {
  id: string;
  moduleKey: string;
  moduleTitle: string;
  moduleIndex: number;
  status: TrackModuleStatus;
  score: number | null;
  questions: BankQuestion[];
};

export type PracticeTrackState = {
  id: string;
  domain: string;
  currentModuleIndex: number;
  completedModuleIds: string[];
  startedAt: string;
  lastActiveAt: string;
  modules: PracticeTrackModule[];
};

export type PracticeAnswerEvaluation = {
  aiUnavailable?: boolean;
  score: number;
  verdict: 'strong' | 'adequate' | 'weak' | string;
  whatTheyGotRight: string;
  whatIsMissing: string;
  improvedAnswer: string;
  followUpQuestion: string;
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
    if (!response.ok) return { ok: false, error: String(data.error ?? 'Request failed.') };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export async function startPracticeTrack(domain: string) {
  const result = await requestJson<{ track: PracticeTrackState }>('/api/tracks/start', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.track };
}

export async function fetchActivePracticeTracks() {
  const result = await requestJson<{ tracks: PracticeTrackState[] }>('/api/tracks/active');
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.tracks };
}

export async function fetchPracticeTrack(trackId: string) {
  const result = await requestJson<{ track: PracticeTrackState }>(`/api/tracks/${encodeURIComponent(trackId)}`);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.track };
}

export async function completeTrackModule(trackId: string, moduleKey: string, score: number) {
  const result = await requestJson<{ track: PracticeTrackState }>(
    `/api/tracks/${encodeURIComponent(trackId)}/modules/${encodeURIComponent(moduleKey)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ score }),
    },
  );
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.track };
}

export async function evaluateTrackModuleAnswer(trackId: string, moduleKey: string, questionId: string, answer: string) {
  const result = await requestJson<{ evaluation: PracticeAnswerEvaluation }>(
    `/api/tracks/${encodeURIComponent(trackId)}/modules/${encodeURIComponent(moduleKey)}/answers`,
    {
      method: 'POST',
      body: JSON.stringify({ questionId, answer }),
    },
  );
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, data: result.data.evaluation };
}
