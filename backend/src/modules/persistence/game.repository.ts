import { v4 as uuidv4 } from 'uuid';
import type { ClaimType } from '@tambola/shared';
import { dbEnabled, pool } from './db';
import { logger } from '../../utils/logger';
import type { Room } from '../room/room.model';

/** Persists a finished game. Best-effort; never throws to caller. */
export async function persistFinishedGame(
  room: Room,
  endedReason: string,
): Promise<void> {
  if (!dbEnabled || !pool) return;
  if (!room.startedAt || !room.endedAt) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert users
    for (const p of room.players.values()) {
      await client.query(
        `INSERT INTO users (id, display_name, kind)
         VALUES ($1,$2,'guest')
         ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
        [p.userId, p.displayName],
      );
    }

    const gameId = uuidv4();
    await client.query(
      `INSERT INTO games (id, room_code, host_id, started_at, ended_at, total_calls, ended_reason)
       VALUES ($1,$2,$3,to_timestamp($4/1000.0),to_timestamp($5/1000.0),$6,$7)`,
      [
        gameId,
        room.code,
        room.hostId,
        room.startedAt,
        room.endedAt,
        room.calledNumbers.length,
        endedReason,
      ],
    );

    for (const p of room.players.values()) {
      const ticket = room.tickets.get(p.userId);
      if (!ticket) continue;
      await client.query(
        `INSERT INTO game_players (game_id, user_id, display_name, ticket_json)
         VALUES ($1,$2,$3,$4)`,
        [gameId, p.userId, p.displayName, JSON.stringify(ticket)],
      );
    }

    const allClaims: Array<{ userId: string; prize: ClaimType; valid: boolean; callIndex: number; claimedAt: number }> = [];
    (Object.keys(room.winners) as ClaimType[]).forEach((prize) => {
      for (const w of room.winners[prize]) {
        allClaims.push({
          userId: w.userId,
          prize,
          valid: true,
          callIndex: w.callIndex,
          claimedAt: w.claimedAt,
        });
      }
    });
    for (const c of allClaims) {
      await client.query(
        `INSERT INTO claims (id, game_id, user_id, prize, valid, call_index, claimed_at)
         VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7/1000.0))`,
        [uuidv4(), gameId, c.userId, c.prize, c.valid, c.callIndex, c.claimedAt],
      );
    }

    await client.query('COMMIT');
    logger.info({ gameId, roomCode: room.code }, 'Game persisted');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error({ err }, 'Failed to persist game');
  } finally {
    client.release();
  }
}
