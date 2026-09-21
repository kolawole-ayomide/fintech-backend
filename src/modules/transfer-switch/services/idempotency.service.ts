import redis from '@config/redis';
import { ConflictError } from '@shared/errors/AppError';
import logger from '@shared/utils/logger';

const LOCK_PREFIX = 'idempotency:transfer:';
const LOCK_TTL_SECONDS = 60 * 15; // 15 min — long enough to cover slow upstream responses

export class IdempotencyService {
  /**
   * Acquires a lock for the given idempotency key. Throws ConflictError if
   * a request with this key is already in flight or was already completed
   * within the TTL window.
   */
  async acquireLock(idempotencyKey: string): Promise<void> {
    const key = `${LOCK_PREFIX}${idempotencyKey}`;

    // SET key value NX EX ttl — atomic "set if not exists"
    const result = await redis.set(key, 'locked', 'EX', LOCK_TTL_SECONDS, 'NX');

    if (result !== 'OK') {
      logger.warn(`[idempotency] duplicate request blocked: ${idempotencyKey}`);
      throw new ConflictError('A request with this idempotency key is already being processed');
    }
  }

  /**
   * Call once the transfer has a final reference, so subsequent duplicate
   * requests can be told "already processed" rather than just "in progress".
   */
  async markCompleted(idempotencyKey: string, transferReference: string): Promise<void> {
    const key = `${LOCK_PREFIX}${idempotencyKey}`;
    await redis.set(key, `completed:${transferReference}`, 'EX', LOCK_TTL_SECONDS, 'XX');
  }

  async releaseLock(idempotencyKey: string): Promise<void> {
    const key = `${LOCK_PREFIX}${idempotencyKey}`;
    await redis.del(key);
  }
}

export const idempotencyService = new IdempotencyService();