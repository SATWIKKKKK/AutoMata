import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearSessionState, persistSessionUser } from '../lib/session';

export interface AuthUser {
  email: string;
  name: string;
  loggedIn: true;
  joinedAt: string;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => {
        if (user) {
          persistSessionUser(user);
        } else {
          clearSessionState();
        }
        set({ user });
      },
      signOut: () => {
        set({ user: null });
        clearSessionState();
      },
    }),
    {
      name: 'orren-auth',
      // Keep legacy key in sync so existing code reading 'automata_user' still works
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          persistSessionUser(state.user);
        }
      },
    },
  ),
);

// Convenience helpers (for non-React code)
export const getAuthUser = (): AuthUser | null =>
  useAuthStore.getState().user;
