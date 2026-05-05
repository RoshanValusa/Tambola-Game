import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './modules/auth/auth.routes';
import { roomRouter } from './modules/room/room.controller';
import { errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin.length > 0 ? env.corsOrigin : true,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  // Global lightweight rate limit for REST endpoints.
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api/auth', authRouter);
  app.use('/api/rooms', roomRouter);

  app.use(errorHandler);
  return app;
}
