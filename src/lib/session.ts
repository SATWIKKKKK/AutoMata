export interface SessionUser {
  id?: string;
  email: string;
  name?: string;
  authProvider?: string;
  emailVerified?: boolean;
  loggedIn?: boolean;
  joinedAt?: string;
}

const SESSION_COOKIE_NAME = 'promptly_session';
const USER_STORAGE_KEY = 'promptly_user';

type AuthResult = { ok: true; user: SessionUser } | { ok: false; error: string };

async function requestJson<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
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
      return { ok: false, error: String((data as { error?: string }).error ?? 'Request failed.') };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export async function registerLocalAccount(payload: { email: string; name: string; password: string }): Promise<AuthResult> {
  const result = await requestJson<{ user: SessionUser }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, user: { ...result.data.user, loggedIn: true } };
}

export async function authenticateLocalAccount(payload: { email: string; password: string }): Promise<AuthResult> {
  const result = await requestJson<{ user: SessionUser }>('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, user: { ...result.data.user, loggedIn: true } };
}

export async function fetchCurrentUser(): Promise<SessionUser | null> {
  const result = await requestJson<{ user: SessionUser }>('/api/auth/session', { method: 'GET' });
  if (!result.ok) return null;
  return { ...result.data.user, loggedIn: true };
}

export function getStoredUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null') as SessionUser | null;
  } catch {
    return null;
  }
}

export function setSessionCookie(value: string) {
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function persistSessionUser(user: SessionUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ ...user, loggedIn: true }));
}

export async function clearSessionState() {
  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore signout network issues for local cache clears.
  }

  localStorage.removeItem(USER_STORAGE_KEY);
  clearSessionCookie();
}