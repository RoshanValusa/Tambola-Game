/**
 * Game and room types shared between backend and frontend.
 * Backend is the single source of truth — these are the wire-format types.
 */

export type GameState = 'lobby' | 'playing' | 'ended';

export type ClaimType =
  | 'early5'
  | 'topLine'
  | 'middleLine'
  | 'bottomLine'
  | 'fullHouse';

export const ALL_CLAIMS: ClaimType[] = [
  'early5',
  'topLine',
  'middleLine',
  'bottomLine',
  'fullHouse',
];

export interface Ticket {
  ticketId: string;
  /** 3 rows × 9 cols. null = blank cell. */
  grid: (number | null)[][];
  /** Flat list of the 15 numbers on the ticket. */
  numbers: number[];
  /** Numbers per row (5 each). */
  rows: [number[], number[], number[]];
}

export interface PlayerPublic {
  userId: string;
  displayName: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export interface RoomConfig {
  maxPlayers: number;
  callIntervalMs: number;
  ticketsPerPlayer: number;
  autoCall: boolean;
}

export interface WinnersByPrize {
  early5: WinnerEntry[];
  topLine: WinnerEntry[];
  middleLine: WinnerEntry[];
  bottomLine: WinnerEntry[];
  fullHouse: WinnerEntry[];
}

export interface WinnerEntry {
  userId: string;
  displayName: string;
  callIndex: number; // index of called number when claim was made
  claimedAt: number;
}

export interface RoomSnapshot {
  roomId: string;
  code: string;
  hostId: string;
  state: GameState;
  players: PlayerPublic[];
  config: RoomConfig;
  calledNumbers: number[];
  lastCalled: number | null;
  winners: WinnersByPrize;
  /** Prizes the current player is disqualified from claiming. */
  myDisqualified?: ClaimType[];
  /** Player's own ticket (only present for that player). */
  myTicket?: Ticket;
  createdAt: number;
}

export interface AuthUser {
  userId: string;
  displayName: string;
  kind: 'guest' | 'user';
}
