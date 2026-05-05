import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware';
import { roomService } from './room.service';
import { Errors } from '../../utils/errors';

export const roomRouter: Router = Router();

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(6, 'Room code must be 6 characters')
  .regex(/^[A-Z0-9]+$/, 'Room code has invalid characters');

/** Create a room. Caller becomes host. */
roomRouter.post('/', requireAuth, (req, res, next) => {
  try {
    const room = roomService.createRoom(req.user!);
    res.json({
      ok: true,
      data: {
        roomId: room.roomId,
        code: room.code,
        hostId: room.hostId,
      },
    });
  } catch (e) {
    next(e);
  }
});

/** Lightweight existence check. */
roomRouter.get('/:code/exists', (req, res, next) => {
  try {
    const code = codeSchema.parse(req.params.code);
    const room = roomService.getRoomByCode(code);
    if (!room) throw Errors.roomNotFound();
    res.json({
      ok: true,
      data: {
        code: room.code,
        state: room.state,
        playerCount: room.players.size,
        maxPlayers: room.config.maxPlayers,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return next(Errors.invalidPayload(e.issues[0].message));
    next(e);
  }
});
