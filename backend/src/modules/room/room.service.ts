import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import type {
  AuthUser,
  ClaimType,
  RoomConfig,
  WinnersByPrize,
} from '@tambola/shared';
import { GAME_CONSTANTS } from '../../config/constants';
import { env } from '../../config/env';
import { Errors } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { generateRoomCode } from '../../utils/code.generator';
import { generateTicket } from '../game/ticket.generator';
import {
  type Player,
  type Room,
  emptyWinners,
} from './room.model';

/**
 * Pure-ish room lifecycle. Mutations happen in-process; transport (socket)
 * subscribes to domain events to broadcast.
 */

export type RoomEvent =
  | { type: 'lobby_update'; roomId: string }
  | { type: 'player_joined'; roomId: string; userId: string }
  | { type: 'player_left'; roomId: string; userId: string }
  | { type: 'host_changed'; roomId: string; hostId: string }
  | { type: 'room_purged'; roomId: string };

export class RoomService extends EventEmitter {
  private readonly rooms = new Map<string, Room>();
  private readonly codeIndex = new Map<string, string>(); // code -> roomId
  /** Tracks which room each user is currently in (one room per user at a time). */
  private readonly userRoom = new Map<string, string>();

  constructor() {
    super();
    // Idle sweep
    setInterval(() => this.sweepIdleRooms(), 60_000).unref();
  }

  /* ----------------------------- Lookups ----------------------------- */

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByCode(code: string): Room | undefined {
    const id = this.codeIndex.get(code.toUpperCase());
    return id ? this.rooms.get(id) : undefined;
  }

  getRoomForUser(userId: string): Room | undefined {
    const id = this.userRoom.get(userId);
    return id ? this.rooms.get(id) : undefined;
  }

  /* ----------------------------- Lifecycle ----------------------------- */

  createRoom(host: AuthUser): Room {
    if (this.userRoom.has(host.userId)) {
      // Allow re-create only if old room is gone; otherwise enforce one room.
      const existing = this.getRoomForUser(host.userId);
      if (existing) throw Errors.alreadyInRoom();
    }

    const code = generateRoomCode(GAME_CONSTANTS.ROOM_CODE_LENGTH, (c) =>
      this.codeIndex.has(c),
    );
    const config: RoomConfig = {
      maxPlayers: env.maxPlayersPerRoom,
      callIntervalMs: env.callDefaultMs,
      ticketsPerPlayer: 1,
      autoCall: true,
    };
    const now = Date.now();
    const room: Room = {
      roomId: uuidv4(),
      code,
      hostId: host.userId,
      state: 'lobby',
      players: new Map(),
      tickets: new Map(),
      calledNumbers: [],
      callOrder: [],
      pool: [],
      winners: emptyWinners(),
      disqualified: new Map(),
      config,
      callTimer: null,
      createdAt: now,
      startedAt: null,
      endedAt: null,
      lastActivityAt: now,
    };

    this.rooms.set(room.roomId, room);
    this.codeIndex.set(code, room.roomId);
    // Register host as a player
    this.addPlayer(room, host, /*asHost*/ true);
    logger.info({ roomId: room.roomId, code }, 'Room created');
    return room;
  }

  joinRoom(code: string, user: AuthUser): Room {
    const room = this.getRoomByCode(code);
    if (!room) throw Errors.roomNotFound();
    this.touch(room);

    const existing = room.players.get(user.userId);
    if (existing) {
      // Reconnect / resume in same room
      this.cancelGrace(existing);
      existing.isConnected = true;
      existing.disconnectedAt = null;
      existing.displayName = user.displayName; // refresh
      this.userRoom.set(user.userId, room.roomId);
      this.emit('event', { type: 'player_joined', roomId: room.roomId, userId: user.userId });
      this.emit('event', { type: 'lobby_update', roomId: room.roomId });
      return room;
    }

    if (room.state !== 'lobby') throw Errors.roomLocked('Cannot join — game already started');
    if (room.players.size >= room.config.maxPlayers) throw Errors.roomFull();

    // If user is in another room, evict them from it.
    const prevRoomId = this.userRoom.get(user.userId);
    if (prevRoomId && prevRoomId !== room.roomId) {
      const prev = this.rooms.get(prevRoomId);
      if (prev) this.removePlayer(prev, user.userId, /*purgeImmediately*/ true);
    }

    this.addPlayer(room, user, /*asHost*/ false);
    return room;
  }

  /** Mark a player disconnected; start grace timer. */
  markDisconnected(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;
    player.isConnected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    this.touch(room);
    this.emit('event', { type: 'lobby_update', roomId });

    this.cancelGrace(player);
    player.graceTimer = setTimeout(() => {
      // After grace: if still disconnected, evict from lobby; mid-game, retain ticket but mark gone.
      const r = this.rooms.get(roomId);
      if (!r) return;
      const p = r.players.get(userId);
      if (!p || p.isConnected) return;
      if (r.state === 'lobby') {
        this.removePlayer(r, userId, /*purgeImmediately*/ true);
      } else {
        // Mid-game: keep ticket+slot for record but free their reservation key.
        // Player can still reconnect; we just stop holding host migration etc. waiting.
        logger.info({ roomId, userId }, 'Grace expired mid-game; player remains absent');
      }
    }, env.reconnectGraceMs);
  }

  /** Used when player explicitly leaves (or grace expired in lobby). */
  removePlayer(room: Room, userId: string, _purgeImmediately = false): void {
    const player = room.players.get(userId);
    if (!player) return;
    this.cancelGrace(player);
    room.players.delete(userId);
    room.tickets.delete(userId);
    if (this.userRoom.get(userId) === room.roomId) this.userRoom.delete(userId);
    this.touch(room);
    this.emit('event', { type: 'player_left', roomId: room.roomId, userId });

    // Host migration
    if (room.hostId === userId && room.players.size > 0) {
      const next = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      next.isHost = true;
      room.hostId = next.userId;
      this.emit('event', { type: 'host_changed', roomId: room.roomId, hostId: next.userId });
    }

    // Empty room → purge
    if (room.players.size === 0) {
      this.purgeRoom(room.roomId);
      return;
    }

    this.emit('event', { type: 'lobby_update', roomId: room.roomId });
  }

  configureRoom(
    roomId: string,
    actorId: string,
    patch: Partial<Pick<RoomConfig, 'callIntervalMs'>>,
  ): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw Errors.roomNotFound();
    if (room.hostId !== actorId) throw Errors.forbidden('Only host can configure room');
    if (room.state !== 'lobby') throw Errors.roomLocked('Cannot configure after game started');

    if (typeof patch.callIntervalMs === 'number') {
      const v = Math.max(
        GAME_CONSTANTS.MIN_CALL_INTERVAL_MS,
        Math.min(GAME_CONSTANTS.MAX_CALL_INTERVAL_MS, Math.floor(patch.callIntervalMs)),
      );
      room.config.callIntervalMs = v;
    }
    this.touch(room);
    this.emit('event', { type: 'lobby_update', roomId });
    return room;
  }

  recordWinner(
    room: Room,
    type: ClaimType,
    userId: string,
    displayName: string,
  ): void {
    room.winners[type].push({
      userId,
      displayName,
      callIndex: room.calledNumbers.length - 1,
      claimedAt: Date.now(),
    });
    this.touch(room);
  }

  recordDisqualification(room: Room, userId: string, type: ClaimType): void {
    let set = room.disqualified.get(userId);
    if (!set) {
      set = new Set();
      room.disqualified.set(userId, set);
    }
    set.add(type);
    this.touch(room);
  }

  getDisqualifiedFor(room: Room, userId: string): ReadonlySet<ClaimType> {
    return room.disqualified.get(userId) ?? new Set<ClaimType>();
  }

  setSocketId(roomId: string, userId: string, socketId: string | null): void {
    const r = this.rooms.get(roomId);
    if (!r) return;
    const p = r.players.get(userId);
    if (p) {
      p.socketId = socketId;
      p.isConnected = socketId != null;
      if (p.isConnected) {
        p.disconnectedAt = null;
        this.cancelGrace(p);
      }
      this.touch(r);
    }
  }

  /* ----------------------------- Internals ----------------------------- */

  private addPlayer(room: Room, user: AuthUser, asHost: boolean): void {
    const now = Date.now();
    const player: Player = {
      userId: user.userId,
      displayName: user.displayName,
      socketId: null,
      isHost: asHost,
      isConnected: false,
      joinedAt: now,
      disconnectedAt: null,
      graceTimer: null,
    };
    room.players.set(user.userId, player);

    // Assign ticket immediately at lobby join.
    if (!room.tickets.has(user.userId)) {
      room.tickets.set(user.userId, generateTicket());
    }
    this.userRoom.set(user.userId, room.roomId);
    this.touch(room);
    this.emit('event', { type: 'player_joined', roomId: room.roomId, userId: user.userId });
    this.emit('event', { type: 'lobby_update', roomId: room.roomId });
  }

  private cancelGrace(player: Player): void {
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
  }

  touch(room: Room): void {
    room.lastActivityAt = Date.now();
  }

  purgeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.callTimer) {
      clearInterval(room.callTimer);
      room.callTimer = null;
    }
    for (const p of room.players.values()) this.cancelGrace(p);
    for (const userId of room.players.keys()) {
      if (this.userRoom.get(userId) === roomId) this.userRoom.delete(userId);
    }
    this.codeIndex.delete(room.code);
    this.rooms.delete(roomId);
    logger.info({ roomId }, 'Room purged');
    this.emit('event', { type: 'room_purged', roomId });
  }

  private sweepIdleRooms(): void {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (now - room.lastActivityAt > env.roomIdleTtlMs) {
        logger.info({ roomId: room.roomId, code: room.code }, 'Sweeping idle room');
        this.purgeRoom(room.roomId);
      }
    }
  }
}

export const roomService = new RoomService();
