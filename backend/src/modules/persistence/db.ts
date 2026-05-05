import { Pool } from 'pg';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export const dbEnabled: boolean = env.databaseUrl.length > 0;

export const pool: Pool | null = dbEnabled
  ? new Pool({
      connectionString: env.databaseUrl,
      max: 10,
      ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
    })
  : null;

if (pool) {
  pool.on('error', (err) => logger.error({ err }, 'Postgres pool error'));
}

export async function query<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!pool) return [];
  const res = await pool.query(sql, params);
  return res.rows as T[];
}
