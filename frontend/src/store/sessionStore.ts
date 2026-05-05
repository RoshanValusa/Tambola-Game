import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@tambola/shared';

interface SessionState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'tambola-session' },
  ),
);
