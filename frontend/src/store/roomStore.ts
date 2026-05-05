import { create } from 'zustand';
import type {
  ClaimType,
  GameState,
  PlayerPublic,
  RoomConfig,
  RoomSnapshot,
  Ticket,
  WinnersByPrize,
} from '@tambola/shared';

interface RoomState {
  roomId: string | null;
  code: string | null;
  hostId: string | null;
  state: GameState;
  players: PlayerPublic[];
  config: RoomConfig | null;

  ticket: Ticket | null;
  calledNumbers: number[];
  lastCalled: number | null;
  marked: Set<number>;
  winners: WinnersByPrize;
  myDisqualified: Set<ClaimType>;

  /** Toast queue for UX (claim results etc.) */
  toasts: Toast[];

  applySnapshot: (s: RoomSnapshot) => void;
  setPlayers: (players: PlayerPublic[], hostId: string, config: RoomConfig) => void;
  upsertPlayer: (p: PlayerPublic) => void;
  removePlayer: (userId: string) => void;
  setHost: (hostId: string) => void;
  pushNumber: (n: number) => void;
  toggleMark: (n: number) => void;
  setState: (state: GameState) => void;
  setWinners: (w: WinnersByPrize) => void;
  addDisqualified: (c: ClaimType) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  reset: () => void;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

const initial = {
  roomId: null,
  code: null,
  hostId: null,
  state: 'lobby' as GameState,
  players: [],
  config: null,
  ticket: null,
  calledNumbers: [],
  lastCalled: null,
  marked: new Set<number>(),
  winners: { early5: [], topLine: [], middleLine: [], bottomLine: [], fullHouse: [] },
  myDisqualified: new Set<ClaimType>(),
  toasts: [],
};

let toastId = 1;

export const useRoomStore = create<RoomState>((set) => ({
  ...initial,

  applySnapshot: (s) =>
    set({
      roomId: s.roomId,
      code: s.code,
      hostId: s.hostId,
      state: s.state,
      players: s.players,
      config: s.config,
      ticket: s.myTicket ?? null,
      calledNumbers: s.calledNumbers,
      lastCalled: s.lastCalled,
      winners: s.winners,
      myDisqualified: new Set(s.myDisqualified ?? []),
    }),

  setPlayers: (players, hostId, config) => set({ players, hostId, config }),

  upsertPlayer: (p) =>
    set((st) => {
      const others = st.players.filter((x) => x.userId !== p.userId);
      return { players: [...others, p].sort((a, b) => a.joinedAt - b.joinedAt) };
    }),

  removePlayer: (userId) =>
    set((st) => ({ players: st.players.filter((p) => p.userId !== userId) })),

  setHost: (hostId) => set({ hostId }),

  pushNumber: (n) =>
    set((st) =>
      st.calledNumbers.includes(n)
        ? st
        : { calledNumbers: [...st.calledNumbers, n], lastCalled: n },
    ),

  toggleMark: (n) =>
    set((st) => {
      const next = new Set(st.marked);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return { marked: next };
    }),

  setState: (state) => set({ state }),
  setWinners: (winners) => set({ winners }),
  addDisqualified: (c) =>
    set((st) => {
      const next = new Set(st.myDisqualified);
      next.add(c);
      return { myDisqualified: next };
    }),

  pushToast: (t) =>
    set((st) => ({
      toasts: [...st.toasts, { ...t, id: toastId++ }].slice(-5),
    })),
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((x) => x.id !== id) })),

  reset: () => set({ ...initial, marked: new Set(), myDisqualified: new Set() }),
}));
