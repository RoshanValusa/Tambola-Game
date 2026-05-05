import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ErrorCodes } from '@tambola/shared';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message } });
    return;
  }
  logger.error({ err }, 'Unhandled HTTP error');
  res.status(500).json({
    ok: false,
    error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' },
  });
};
