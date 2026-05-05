import { dbEnabled, pool } from './db';
import { logger } from '../../utils/logger';
import { MIGRATIONS } from './migrations';

export async function runMigrations(): Promise<void> {
  if (!dbEnabled || !pool) {
    logger.warn('DATABASE_URL not set — skipping migrations');
    return;
  }
  for (const m of MIGRATIONS) {
    logger.info({ migration: m.name }, 'Running migration');
    await pool.query(m.sql);
  }
  logger.info('Migrations complete');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Migration failed');
      process.exit(1);
    });
}
