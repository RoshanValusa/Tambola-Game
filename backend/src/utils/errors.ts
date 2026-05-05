import { ErrorCodes, type ErrorCode } from '@tambola/shared';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;

  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const Errors = {
  unauthorized: (msg = 'Unauthorized') => new AppError(ErrorCodes.UNAUTHORIZED, msg, 401),
  forbidden: (msg = 'Forbidden') => new AppError(ErrorCodes.FORBIDDEN, msg, 403),
  roomNotFound: () => new AppError(ErrorCodes.ROOM_NOT_FOUND, 'Room not found', 404),
  roomFull: () => new AppError(ErrorCodes.ROOM_FULL, 'Room is full', 409),
  roomLocked: (msg = 'Game already in progress or ended') =>
    new AppError(ErrorCodes.ROOM_LOCKED, msg, 409),
  alreadyInRoom: () =>
    new AppError(ErrorCodes.ALREADY_IN_ROOM, 'Already in another room', 409),
  notInRoom: () => new AppError(ErrorCodes.NOT_IN_ROOM, 'Not in a room', 400),
  invalidClaim: (reason: string) =>
    new AppError(ErrorCodes.INVALID_CLAIM, `Invalid claim: ${reason}`, 400),
  prizeAwarded: () =>
    new AppError(ErrorCodes.PRIZE_ALREADY_AWARDED, 'Prize already awarded', 409),
  disqualified: () =>
    new AppError(
      ErrorCodes.PLAYER_DISQUALIFIED,
      'You are disqualified from claiming this prize',
      403,
    ),
  rateLimited: () => new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests', 429),
  invalidPayload: (msg = 'Invalid payload') =>
    new AppError(ErrorCodes.INVALID_PAYLOAD, msg, 400),
  notEnoughPlayers: () =>
    new AppError(ErrorCodes.NOT_ENOUGH_PLAYERS, 'Need at least 2 players to start', 400),
  gameNotStarted: () =>
    new AppError(ErrorCodes.GAME_NOT_STARTED, 'Game has not started', 400),
  internal: (msg = 'Internal server error') =>
    new AppError(ErrorCodes.INTERNAL, msg, 500),
};
