import 'dotenv/config';

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

export const env = {
  nodeEnv: str(process.env.NODE_ENV, 'development'),
  port: num(process.env.PORT, 4000),
  logLevel: str(process.env.LOG_LEVEL, 'info'),

  jwtSecret: str(
    process.env.JWT_SECRET,
    process.env.NODE_ENV === 'production' ? '' : 'dev-only-secret-do-not-use-in-prod',
  ),
  jwtExpiresIn: str(process.env.JWT_EXPIRES_IN, '7d'),

  corsOrigin: str(process.env.CORS_ORIGIN, 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  callDefaultMs: num(process.env.CALL_DEFAULT_MS, 5000),
  reconnectGraceMs: num(process.env.RECONNECT_GRACE_MS, 60_000),
  roomIdleTtlMs: num(process.env.ROOM_IDLE_TTL_MS, 30 * 60_000),
  maxPlayersPerRoom: num(process.env.MAX_PLAYERS_PER_ROOM, 50),

  databaseUrl: process.env.DATABASE_URL ?? '',
};

if (env.nodeEnv === 'production' && !env.jwtSecret) {
  // Fail-fast: refuse to boot a prod server without a secret.
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_SECRET is required in production.');
  process.exit(1);
}
