import { DOMAIN_LABELS } from './prep';
import { normalizeThemePreference, type ThemePreference } from './theme';

export type UserPreferences = {
  sidebarOpen: boolean;
  theme: ThemePreference;
  domain: string;
};

type UserPreferencesResult =
  | { ok: true; data: UserPreferences }
  | { ok: false; error: string };

function normalizeDomain(value: unknown) {
  const domain = String(value ?? '').trim();
  return DOMAIN_LABELS[domain] ? domain : '';
}

function normalizePreferences(payload: unknown): UserPreferences {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return {
    sidebarOpen: Boolean(source.sidebarOpen),
    theme: normalizeThemePreference(source.theme),
    domain: normalizeDomain(source.domain),
  };
}

async function requestPreferences(path: string, init?: RequestInit): Promise<UserPreferencesResult> {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: String((data as { error?: unknown }).error ?? 'Unable to load preferences.') };
    }
    return { ok: true, data: normalizePreferences(data) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network request failed.' };
  }
}

export function fetchUserPreferences() {
  return requestPreferences('/api/users/preferences');
}

export function updateUserPreferences(update: Partial<UserPreferences>) {
  return requestPreferences('/api/users/preferences', {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}
