import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  SocketEvents,
  type ClaimResultEvent,
  type GameEndedEvent,
  type GameStartedEvent,
  type HostChangedEvent,
  type LobbyUpdateEvent,
  type NumberCalledEvent,
  type PlayerJoinedEvent,
  type PlayerLeftEvent,
  type RoomSnapshotEvent,
  type ServerAck,
  type SocketErrorEvent,
} from '@tambola/shared';
import { verifyToken } from '../auth/jwt';
import { roomService, type RoomEvent } from '../room/room.service';
import { GameEngine, type EngineEvent } from '../game/game.engine';
import { toPlayerPublic, toRoomSnapshot, type Room } from '../room/room.model';
import { AppError, Errors } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { RATE_LIMITS } from '../../config/constants';
import { ErrorCodes } from '@tambola/shared';
import { persistFinishedGame } from '../persistence/game.repository';

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(6)
    .regex(/^[A-Z0-9]+$/),
});
const claimSchema = z.object({
  claim: z.enum(['early5', 'topLine', 'middleLine', 'bottomLine', 'fullHouse']),
});
const configureSchema = z.object({
  callIntervalMs: z.number().int().min(2000).max(20_000).optional(),
});

interface SocketData {
  userId: string;
  displayName: string;
  /** Per-event call timestamps for rate limiting. */
  rate: Map<string, number[]>;
}

function data(socket: Socket): SocketData {
  return socket.data as SocketData;
}

export function attachSocket(io: Server): GameEngine {
  const engine = new GameEngine(roomService);

  /* -------------------- Auth middleware -------------------- */
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.toString().replace(/^Bearer /, '') || '');
      if (!token) return next(new Error('UNAUTHORIZED'));
      const user = verifyToken(token);
      socket.data = {
        userId: user.userId,
        displayName: user.displayName,
        rate: new Map(),
      };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  /* -------------------- Domain event subscribers -------------------- */
  roomService.on('event', (e: RoomEvent) => {
    const room = roomService.getRoom(e.roomId);
    if (!room) return;
    switch (e.type) {
      case 'player_joined': {
        const p = room.players.get(e.userId);
        if (!p) return;
        const payload: PlayerJoinedEvent = { player: toPlayerPublic(p) };
        io.to(e.roomId).emit(SocketEvents.PLAYER_JOINED, payload);
        break;
      }
      case 'player_left': {
        const payload: PlayerLeftEvent = { userId: e.userId };
        io.to(e.roomId).emit(SocketEvents.PLAYER_LEFT, payload);
        break;
      }
      case 'lobby_update': {
        const payload: LobbyUpdateEvent = {
          players: [...room.players.values()].map(toPlayerPublic),
          hostId: room.hostId,
          config: room.config,
        };
        io.to(e.roomId).emit(SocketEvents.LOBBY_UPDATE, payload);
        break;
      }
      case 'host_changed': {
        const payload: HostChangedEvent = { hostId: e.hostId };
        io.to(e.roomId).emit(SocketEvents.HOST_CHANGED, payload);
        break;
      }
      case 'room_purged': {
        io.in(e.roomId).socketsLeave(e.roomId);
        break;
      }
    }
  });

  engine.on('event', (e: EngineEvent) => {
    switch (e.type) {
      case 'game_started': {
        const payload: GameStartedEvent = {
          startedAt: e.startedAt,
          callIntervalMs: e.callIntervalMs,
        };
        io.to(e.roomId).emit(SocketEvents.GAME_STARTED, payload);
        break;
      }
      case 'number_called': {
        io.to(e.roomId).emit(SocketEvents.NUMBER_CALLED, e.payload satisfies NumberCalledEvent);
        break;
      }
      case 'claim_result': {
        const room = roomService.getRoom(e.roomId);
        if (!room) return;
        const payload: ClaimResultEvent = {
          userId: e.userId,
          displayName: e.displayName,
          claim: e.claim,
          valid: e.valid,
          reason: e.reason,
          winners: room.winners,
        };
        io.to(e.roomId).emit(SocketEvents.CLAIM_RESULT, payload);
        break;
      }
      case 'game_ended': {
        io.to(e.roomId).emit(SocketEvents.GAME_ENDED, e.payload satisfies GameEndedEvent);
        const room = roomService.getRoom(e.roomId);
        if (room) {
          // Best-effort persistence
          void persistFinishedGame(room, e.payload.reason);
        }
        break;
      }
    }
  });

  /* -------------------- Connection handler -------------------- */
  io.on('connection', (socket) => {
    const sd = data(socket);
    logger.debug(
      { sid: socket.id, userId: sd.userId, name: sd.displayName },
      'Socket connected',
    );

    // If user is already in a room (e.g., reconnect after refresh), auto-rejoin.
    const existing = roomService.getRoomForUser(sd.userId);
    if (existing) {
      void rejoinRoom(socket, existing);
    }

    socket.on(SocketEvents.JOIN_ROOM, withAck(socket, SocketEvents.JOIN_ROOM, async (payload) => {
      const parsed = joinSchema.parse(payload);
      const user = { userId: sd.userId, displayName: sd.displayName, kind: 'guest' as const };
      const room = roomService.joinRoom(parsed.code, user);
      await rejoinRoom(socket, room);
      return { roomId: room.roomId, code: room.code };
    }));

    socket.on(SocketEvents.LEAVE_ROOM, withAck(socket, SocketEvents.LEAVE_ROOM, async () => {
      const room = roomService.getRoomForUser(sd.userId);
      if (!room) return { left: false };
      socket.leave(room.roomId);
      roomService.removePlayer(room, sd.userId, true);
      return { left: true };
    }));

    socket.on(SocketEvents.START_GAME, withAck(socket, SocketEvents.START_GAME, async () => {
      checkRate(socket, 'start_game', RATE_LIMITS.START_PER_SECOND);
      const room = currentRoomOrThrow(socket);
      engine.startGame(room.roomId, sd.userId);
      return { started: true };
    }));

    socket.on(SocketEvents.CONFIGURE_ROOM, withAck(socket, SocketEvents.CONFIGURE_ROOM, async (payload) => {
      checkRate(socket, 'configure', RATE_LIMITS.CONFIGURE_PER_SECOND);
      const parsed = configureSchema.parse(payload);
      const room = currentRoomOrThrow(socket);
      roomService.configureRoom(room.roomId, sd.userId, parsed);
      return { config: room.config };
    }));

    socket.on(SocketEvents.CLAIM_WIN, withAck(socket, SocketEvents.CLAIM_WIN, async (payload) => {
      checkRate(socket, 'claim', RATE_LIMITS.CLAIM_PER_SECOND);
      const parsed = claimSchema.parse(payload);
      const room = currentRoomOrThrow(socket);
      engine.submitClaim(room.roomId, sd.userId, parsed.claim);
      return { submitted: true };
    }));

    socket.on(SocketEvents.END_GAME, withAck(socket, SocketEvents.END_GAME, async () => {
      const room = currentRoomOrThrow(socket);
      engine.forceEnd(room.roomId, sd.userId);
      return { ended: true };
    }));

    socket.on('disconnect', () => {
      const room = roomService.getRoomForUser(sd.userId);
      if (room) {
        roomService.markDisconnected(room.roomId, sd.userId);
      }
    });
  });

  return engine;
}

/* -------------------- Helpers -------------------- */

function currentRoomOrThrow(socket: Socket): Room {
  const room = roomService.getRoomForUser(data(socket).userId);
  if (!room) throw Errors.notInRoom();
  return room;
}

async function rejoinRoom(socket: Socket, room: Room): Promise<void> {
  socket.join(room.roomId);
  roomService.setSocketId(room.roomId, data(socket).userId, socket.id);
  const snap: RoomSnapshotEvent = toRoomSnapshot(room, data(socket).userId);
  socket.emit(SocketEvents.ROOM_SNAPSHOT, snap);
}

function checkRate(socket: Socket, key: string, perSecond: number): void {
  const now = Date.now();
  const sd = data(socket);
  const list = sd.rate.get(key) ?? [];
  const cutoff = now - 1000;
  const recent = list.filter((t: number) => t >= cutoff);
  if (recent.length >= perSecond) {
    throw Errors.rateLimited();
  }
  recent.push(now);
  sd.rate.set(key, recent);
}

type Handler<P> = (payload: P) => Promise<unknown> | unknown;

function withAck<P>(socket: Socket, event: string, handler: Handler<P>) {
  return async (payload: P, ack?: (resp: ServerAck) => void) => {
    try {
      const data = await handler(payload);
      ack?.({ ok: true, data });
    } catch (err) {
      const resp = toErrorAck(err, event);
      ack?.(resp);
      socket.emit(SocketEvents.ERROR, {
        code: resp.error!.code,
        message: resp.error!.message,
        event,
      } satisfies SocketErrorEvent);
    }
  };
}

function toErrorAck(err: unknown, event: string): ServerAck {
  if (err instanceof AppError) {
    return { ok: false, error: { code: err.code, message: err.message } };
  }
  if (err instanceof z.ZodError) {
    return {
      ok: false,
      error: { code: ErrorCodes.INVALID_PAYLOAD, message: err.issues[0].message },
    };
  }
  logger.error({ err, event }, 'Unhandled socket error');
  return {
    ok: false,
    error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' },
  };
}
