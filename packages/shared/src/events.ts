import type {
  ClaimType,
  PlayerPublic,
  RoomSnapshot,
  WinnersByPrize,
  Ticket,
} from './types';

/** Single source of truth for socket event names. */
export const SocketEvents = {
  // client -> server
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  START_GAME: 'start_game',
  CONFIGURE_ROOM: 'configure_room',
  CLAIM_WIN: 'claim_win',
  END_GAME: 'end_game',

  // server -> client
  ROOM_SNAPSHOT: 'room_snapshot',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  LOBBY_UPDATE: 'lobby_update',
  GAME_STARTED: 'game_started',
  NUMBER_CALLED: 'number_called',
  CLAIM_RESULT: 'claim_result',
  GAME_ENDED: 'game_ended',
  HOST_CHANGED: 'host_changed',
  ERROR: 'error',
} as const;

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];

/* ===================== Client -> Server payloads ===================== */
export interface JoinRoomPayload {
  code: string;
}
export interface StartGamePayload {
  /* host-only */
}
export interface ConfigureRoomPayload {
  callIntervalMs?: number;
}
export interface ClaimWinPayload {
  claim: ClaimType;
}

/* ===================== Server -> Client payloads ===================== */
export interface ServerAck<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface RoomSnapshotEvent extends RoomSnapshot {}

export interface PlayerJoinedEvent {
  player: PlayerPublic;
}
export interface PlayerLeftEvent {
  userId: string;
}
export interface LobbyUpdateEvent {
  players: PlayerPublic[];
  hostId: string;
  config: RoomSnapshot['config'];
}

export interface GameStartedEvent {
  startedAt: number;
  callIntervalMs: number;
}

export interface NumberCalledEvent {
  number: number;
  callIndex: number; // 0-based
  totalCalled: number;
}

export interface ClaimResultEvent {
  userId: string;
  displayName: string;
  claim: ClaimType;
  valid: boolean;
  reason?: string;
  winners: WinnersByPrize;
}

export interface GameEndedEvent {
  winners: WinnersByPrize;
  endedAt: number;
  reason: 'fullHouse' | 'pool_exhausted' | 'host_ended';
  totalCalls: number;
}

export interface HostChangedEvent {
  hostId: string;
}

export interface SocketErrorEvent {
  code: string;
  message: string;
  event?: string;
}

/** Mirror Ticket re-export for client-side imports. */
export type { Ticket };
