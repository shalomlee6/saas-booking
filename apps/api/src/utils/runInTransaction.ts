import mongoose, { type ClientSession } from 'mongoose';
import { HttpError } from '../errors/httpErrors';
import { logger } from './logger';

function isStandaloneTransactionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const message = 'message' in error && error.message != null ? String(error.message) : '';
  const codeName = 'codeName' in error && typeof error.codeName === 'string' ? error.codeName : undefined;
  return codeName === 'IllegalOperation' || message.includes('Transaction numbers are only allowed');
}

/**
 * Runs `work` in one MongoDB transaction: every write commits together or none does.
 * `work` must pass the session it is given to every query and write.
 *
 * A standalone MongoDB has no transactions. Outside production `work` then runs once without a session
 * (so local development and tests still work); production fails with 503, like appointment creation.
 */
export async function runInTransaction<T>(work: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error) {
      if (!isStandaloneTransactionError(error)) throw error;
      if (process.env.NODE_ENV === 'production') {
        throw new HttpError(503, 'Database transaction support is required', 'TXN_REQUIRED');
      }
      logger.warn('transaction_unsupported_running_without', {});
      return await work(undefined);
    }
  } finally {
    await session.endSession();
  }
}
