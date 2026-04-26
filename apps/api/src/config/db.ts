import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDB(uri: string, nodeEnv: 'development' | 'production' | 'test'): Promise<void> {
  const maxAttempts = nodeEnv === 'production' ? 5 : 10;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      await mongoose.connect(uri);
      logger.info('mongodb_connected', { attempt });
      return;
    } catch (err) {
      const waitMs = Math.min(1000 * 2 ** (attempt - 1), 10_000);
      logger.error('mongodb_connection_failed', {
        attempt,
        maxAttempts,
        waitMs,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt >= maxAttempts) {
        if (nodeEnv === 'production') {
          process.exit(1);
        }
        logger.warn('mongodb_unavailable_development_mode', {
          message:
            'Continuing without database in development/test. Data routes will fail until MongoDB is available.',
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
