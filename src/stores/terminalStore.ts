import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface TerminalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokensUsed?: number;
  costInr?: number;
  createdAt: string;
}

interface TerminalState {
  messages: TerminalMessage[];
  sessionId: string;
  addMessage: (message: TerminalMessage) => void;
  updateLastMessage: (content: string) => void;
  clearSession: () => void;
}

const MAX_MESSAGES = 100;

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      messages: [],
      sessionId: uuidv4(),

      addMessage: (message) =>
        set((s) => ({
          messages: [...s.messages, message].slice(-MAX_MESSAGES),
        })),

      updateLastMessage: (content) =>
        set((s) => {
          const msgs = [...s.messages];
          if (msgs.length === 0) return s;
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
          return { messages: msgs };
        }),

      clearSession: () =>
        set({ messages: [], sessionId: uuidv4() }),
    }),
    {
      name: 'orren-terminal',
      partialize: (s) => ({
        messages: s.messages.slice(-MAX_MESSAGES),
        sessionId: s.sessionId,
      }),
    },
  ),
);
