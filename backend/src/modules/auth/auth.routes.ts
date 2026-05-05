import { Router } from 'express';
import { z } from 'zod';
import { signGuestToken } from './jwt';
import { Errors } from '../../utils/errors';

const guestSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(20, 'Display name must be at most 20 characters')
    .regex(/^[A-Za-z0-9 _.-]+$/, 'Display name has invalid characters'),
});

export const authRouter: Router = Router();

authRouter.post('/guest', (req, res, next) => {
  try {
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.invalidPayload(parsed.error.issues[0].message);
    const { token, user } = signGuestToken(parsed.data.displayName);
    res.json({ ok: true, data: { token, user } });
  } catch (e) {
    next(e);
  }
});
