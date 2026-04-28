export interface SessionUser {
  email: string;
  name?: string;
  loggedIn?: boolean;
  joinedAt?: string;
}

interface StoredAccount {
  email: string;
  name: string;
  password: string;
  createdAt: string;
}

const SESSION_COOKIE_NAME = 'automata_session';
const ACCOUNTS_KEY = 'automata_accounts';

function getStoredAccounts(): StoredAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') as StoredAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => Boolean(entry?.email && entry?.password && entry?.name));
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function registerLocalAccount(payload: { email: string; name: string; password: string }): { ok: true; user: SessionUser } | { ok: false; error: string } {
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();
  const password = payload.password;

  if (!email) return { ok: false, error: 'Email is required.' };
  if (!name || name.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };
  if (!password || password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

  const accounts = getStoredAccounts();
  if (accounts.some((account) => account.email.toLowerCase() === email)) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  accounts.push({
    email,
    name,
    password,
    createdAt: new Date().toISOString(),
  });
  saveStoredAccounts(accounts);

  return {
    ok: true,
    user: {
      email,
      name,
      loggedIn: true,
      joinedAt: new Date().toISOString(),
    },
  };
}

export function authenticateLocalAccount(payload: { email: string; password: string }): { ok: true; user: SessionUser } | { ok: false; error: string } {
  const email = payload.email.trim().toLowerCase();
  const password = payload.password;

  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const accounts = getStoredAccounts();
  const account = accounts.find((entry) => entry.email.toLowerCase() === email);
  if (!account) {
    return { ok: false, error: 'No account found for this email.' };
  }
  if (account.password !== password) {
    return { ok: false, error: 'Incorrect password.' };
  }

  return {
    ok: true,
    user: {
      email: account.email,
      name: account.name,
      loggedIn: true,
      joinedAt: account.createdAt,
    },
  };
}

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
  try {
    void fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore signout network issues for local session clears.
  }
  localStorage.removeItem('automata_user');
  localStorage.removeItem('automata-terminal-session');
  localStorage.removeItem('automata_active_workflow');
  clearSessionCookie();
}