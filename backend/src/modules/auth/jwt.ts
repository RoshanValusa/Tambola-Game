import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { AuthUser } from '@tambola/shared';
import { env } from '../../config/env';

export interface TokenClaims extends AuthUser {
  iat?: number;
  exp?: number;
}

export function signGuestToken(displayName: string): { token: string; user: AuthUser } {
  const user: AuthUser = {
    userId: uuidv4(),
    displayName,
    kind: 'guest',
  };
  const token = jwt.sign(user, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
  return { token, user };
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.jwtSecret) as TokenClaims;
  if (!decoded?.userId || !decoded.displayName) {
    throw new Error('Malformed token');
  }
  return {
    userId: decoded.userId,
    displayName: decoded.displayName,
    kind: decoded.kind ?? 'guest',
  };
}
