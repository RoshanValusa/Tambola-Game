import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { attachSocket } from './modules/socket/socket.handler';
import { runMigrations } from './modules/persistence/migrate';

async function main() {
  // Best-effort migrations on boot
  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, 'Migrations failed at boot (continuing)');
  }

  const app = createApp();
  const httpServer = createServer(app);
  const io = new IOServer(httpServer, {
    cors: {
      origin: env.corsOrigin.length > 0 ? env.corsOrigin : true,
      credentials: false,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  attachSocket(io);

  httpServer.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'Tambola backend listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal boot error');
  process.exit(1);
});
