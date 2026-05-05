import { EventEmitter } from 'node:events';
import type {
  ClaimType,
  GameEndedEvent,
  NumberCalledEvent,
} from '@tambola/shared';
import { GAME_CONSTANTS } from '../../config/constants';
import { Errors } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { shuffleInPlace } from '../../utils/random';
import type { Room } from '../room/room.model';
import { type RoomService } from '../room/room.service';
import { validateClaim } from './claim.validator';

export type EngineEvent =
  | { type: 'game_started'; roomId: string; startedAt: number; callIntervalMs: number }
  | { type: 'number_called'; roomId: string; payload: NumberCalledEvent }
  | { type: 'game_ended'; roomId: string; payload: GameEndedEvent }
  | {
      type: 'claim_result';
      roomId: string;
      userId: string;
      displayName: string;
      claim: ClaimType;
      valid: boolean;
      reason?: string;
    };

export class GameEngine extends EventEmitter {
  constructor(private readonly rooms: RoomService) {
    super();
  }

  startGame(roomId: string, actorId: string): void {
    const room = this.rooms.getRoom(roomId);
    if (!room) throw Errors.roomNotFound();
    if (room.hostId !== actorId) throw Errors.forbidden('Only host can start the game');
    if (room.state !== 'lobby') throw Errors.roomLocked('Game already started or ended');
    if (room.players.size < GAME_CONSTANTS.MIN_PLAYERS_TO_START) {
      throw Errors.notEnoughPlayers();
    }

    // Build shuffled pool 1..90 with crypto RNG.
    const pool: number[] = [];
    for (let i = 1; i <= GAME_CONSTANTS.TOTAL_NUMBERS; i++) pool.push(i);
    shuffleInPlace(pool);
    room.pool = pool;
    room.calledNumbers = [];
    room.callOrder = [];
    room.state = 'playing';
    room.startedAt = Date.now();
    this.rooms.touch(room);

    this.emit('event', {
      type: 'game_started',
      roomId,
      startedAt: room.startedAt,
      callIntervalMs: room.config.callIntervalMs,
    } satisfies EngineEvent);

    // Schedule first call after a short delay so clients receive game_started first.
    this.scheduleNextCall(room, 1000);
    logger.info({ roomId, players: room.players.size }, 'Game started');
  }

  private scheduleNextCall(room: Room, delayMs?: number): void {
    if (room.callTimer) clearTimeout(room.callTimer);
    if (room.state !== 'playing') return;
    const wait = delayMs ?? room.config.callIntervalMs;
    room.callTimer = setTimeout(() => this.tick(room), wait);
  }

  private tick(room: Room): void {
    if (room.state !== 'playing') return;
    if (room.pool.length === 0) {
      this.endGame(room, 'pool_exhausted');
      return;
    }
    const next = room.pool.shift()!;
    room.calledNumbers.push(next);
    room.callOrder.push(next);
    this.rooms.touch(room);

    const payload: NumberCalledEvent = {
      number: next,
      callIndex: room.calledNumbers.length - 1,
      totalCalled: room.calledNumbers.length,
    };
    this.emit('event', {
      type: 'number_called',
      roomId: room.roomId,
      payload,
    } satisfies EngineEvent);

    this.scheduleNextCall(room);
  }

  /** Process a claim. Returns true if accepted. */
  submitClaim(roomId: string, actorId: string, claim: ClaimType): void {
    const room = this.rooms.getRoom(roomId);
    if (!room) throw Errors.roomNotFound();
    if (room.state !== 'playing') throw Errors.gameNotStarted();
    const player = room.players.get(actorId);
    if (!player) throw Errors.notInRoom();
    const ticket = room.tickets.get(actorId);
    if (!ticket) throw Errors.notInRoom();

    const result = validateClaim(claim, {
      ticket,
      calledNumbers: new Set(room.calledNumbers),
      winners: room.winners,
      disqualifiedFrom: this.rooms.getDisqualifiedFor(room, actorId),
    });

    if (result.ok) {
      this.rooms.recordWinner(room, claim, actorId, player.displayName);
      this.emit('event', {
        type: 'claim_result',
        roomId,
        userId: actorId,
        displayName: player.displayName,
        claim,
        valid: true,
      } satisfies EngineEvent);

      // Full house ends the game.
      if (claim === 'fullHouse') {
        this.endGame(room, 'fullHouse');
      }
    } else {
      this.rooms.recordDisqualification(room, actorId, claim);
      this.emit('event', {
        type: 'claim_result',
        roomId,
        userId: actorId,
        displayName: player.displayName,
        claim,
        valid: false,
        reason: result.reason,
      } satisfies EngineEvent);
    }
  }

  endGame(roomOrId: Room | string, reason: GameEndedEvent['reason']): void {
    const room = typeof roomOrId === 'string' ? this.rooms.getRoom(roomOrId) : roomOrId;
    if (!room) throw Errors.roomNotFound();
    if (room.state === 'ended') return;
    if (room.callTimer) {
      clearTimeout(room.callTimer);
      room.callTimer = null;
    }
    room.state = 'ended';
    room.endedAt = Date.now();
    this.rooms.touch(room);

    const payload: GameEndedEvent = {
      winners: room.winners,
      endedAt: room.endedAt,
      reason,
      totalCalls: room.calledNumbers.length,
    };
    this.emit('event', {
      type: 'game_ended',
      roomId: room.roomId,
      payload,
    } satisfies EngineEvent);
    logger.info({ roomId: room.roomId, reason, totalCalls: room.calledNumbers.length }, 'Game ended');
  }

  forceEnd(roomId: string, actorId: string): void {
    const room = this.rooms.getRoom(roomId);
    if (!room) throw Errors.roomNotFound();
    if (room.hostId !== actorId) throw Errors.forbidden('Only host can end the game');
    if (room.state !== 'playing') throw Errors.gameNotStarted();
    this.endGame(room, 'host_ended');
  }
}
