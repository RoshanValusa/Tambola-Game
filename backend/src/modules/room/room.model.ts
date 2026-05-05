import type {
  GameState,
  PlayerPublic,
  RoomConfig,
  RoomSnapshot,
  Ticket,
  WinnersByPrize,
  ClaimType,
} from '@tambola/shared';

export interface Player {
  userId: string;
  displayName: string;
  socketId: string | null;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
  disconnectedAt: number | null;
  /** Timer to fully evict on grace expiry. */
  graceTimer: NodeJS.Timeout | null;
}

export interface Room {
  roomId: string;
  code: string;
  hostId: string;
  state: GameState;
  players: Map<string, Player>;
  tickets: Map<string, Ticket>;
  calledNumbers: number[];
  callOrder: number[]; // identical to calledNumbers for now (kept for clarity)
  pool: number[]; // pre-shuffled numbers remaining
  winners: WinnersByPrize;
  disqualified: Map<string, Set<ClaimType>>;
  config: RoomConfig;
  callTimer: NodeJS.Timeout | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  lastActivityAt: number;
}

export function emptyWinners(): WinnersByPrize {
  return { early5: [], topLine: [], middleLine: [], bottomLine: [], fullHouse: [] };
}

export function toPlayerPublic(p: Player): PlayerPublic {
  return {
    userId: p.userId,
    displayName: p.displayName,
    isHost: p.isHost,
    isConnected: p.isConnected,
    joinedAt: p.joinedAt,
  };
}

export function toRoomSnapshot(
  room: Room,
  forUserId?: string,
): RoomSnapshot {
  const players: PlayerPublic[] = [];
  for (const p of room.players.values()) players.push(toPlayerPublic(p));
  const myTicket = forUserId ? room.tickets.get(forUserId) : undefined;
  const myDq = forUserId ? room.disqualified.get(forUserId) : undefined;
  return {
    roomId: room.roomId,
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    players,
    config: room.config,
    calledNumbers: [...room.calledNumbers],
    lastCalled:
      room.calledNumbers.length > 0 ? room.calledNumbers[room.calledNumbers.length - 1] : null,
    winners: room.winners,
    myTicket,
    myDisqualified: myDq ? Array.from(myDq) : [],
    createdAt: room.createdAt,
  };
}
