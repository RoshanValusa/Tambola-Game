import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';
import { Errors } from '../../utils/errors';
import type { AuthUser } from '@tambola/shared';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Errors.unauthorized('Missing token');
    const token = header.slice('Bearer '.length);
    req.user = verifyToken(token);
    next();
  } catch (e) {
    if ((e as Error).name === 'JsonWebTokenError' || (e as Error).name === 'TokenExpiredError') {
      next(Errors.unauthorized('Invalid token'));
      return;
    }
    next(e);
  }
}
