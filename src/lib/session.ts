export interface SessionUser {
  email: string;
  name?: string;
  loggedIn?: boolean;
  joinedAt?: string;
}

const SESSION_COOKIE_NAME = 'automata_session';

export function getStoredUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem('automata_user') || 'null') as SessionUser | null;
  } catch {
    return null;
  }
}

export function setSessionCookie(email: string) {
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(email)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function persistSessionUser(user: SessionUser) {
  localStorage.setItem('automata_user', JSON.stringify(user));
  if (user.email) {
    setSessionCookie(user.email);
  }
}

export function clearSessionState() {
  localStorage.removeItem('automata_user');
  localStorage.removeItem('automata-terminal-session');
  localStorage.removeItem('automata_active_workflow');
  clearSessionCookie();
}