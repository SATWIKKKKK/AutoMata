export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

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
    if (!response.ok) return { ok: false, error: String(data.error ?? 'Request failed.'), status: response.status };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export function localDraftKey(feature: string, attemptId: string) {
  return `repoid-round-draft:${feature}:${attemptId}`;
}

export function saveLocalDraft(feature: string, attemptId: string, payload: unknown) {
  try {
    window.localStorage.setItem(localDraftKey(feature, attemptId), JSON.stringify({ payload, savedAt: new Date().toISOString() }));
  } catch {
    // localStorage may be blocked; server autosave still protects submitted drafts.
  }
}

export function readLocalDraft<T>(feature: string, attemptId: string): { payload: T; savedAt: string } | null {
  try {
    const raw = window.localStorage.getItem(localDraftKey(feature, attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload?: T; savedAt?: string };
    return parsed.payload && parsed.savedAt ? { payload: parsed.payload, savedAt: parsed.savedAt } : null;
  } catch {
    return null;
  }
}

export async function saveServerDraft(feature: string, attemptId: string, payload: unknown) {
  return requestJson<{ success: boolean; savedAt: string }>(`/api/round-drafts/${encodeURIComponent(feature)}/${encodeURIComponent(attemptId)}`, {
    method: 'POST',
    body: JSON.stringify({ payload }),
  });
}

export async function fetchServerDraft<T>(feature: string, attemptId: string) {
  const result = await requestJson<{ draft: { payload: T; savedAt: string } | null }>(`/api/round-drafts/${encodeURIComponent(feature)}/${encodeURIComponent(attemptId)}`);
  if (result.ok === false) return result;
  return { ok: true as const, data: result.data.draft };
}

export async function logFocusEvent(attemptId: string, feature: string, eventType: string, detail: Record<string, unknown> = {}) {
  return requestJson<{ success: boolean }>(`/api/rounds/${encodeURIComponent(attemptId)}/focus-event`, {
    method: 'POST',
    body: JSON.stringify({ feature, eventType, detail }),
  });
}

export async function abandonRound(attemptId: string, feature: string, reason: string) {
  return requestJson<{ success: boolean }>(`/api/rounds/${encodeURIComponent(attemptId)}/abandon`, {
    method: 'POST',
    body: JSON.stringify({ feature, reason }),
  });
}

export function shouldPromptForLocalDraft(localSavedAt: string, serverSavedAt?: string | null) {
  if (!serverSavedAt) return true;
  const localTime = new Date(localSavedAt).getTime();
  const serverTime = new Date(serverSavedAt).getTime();
  return Number.isFinite(localTime) && Number.isFinite(serverTime) && localTime - serverTime > 5 * 60 * 1000;
}
