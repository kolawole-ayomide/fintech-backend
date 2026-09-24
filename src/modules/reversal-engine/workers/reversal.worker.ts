import { Worker } from 'bullmq';
import redis from '@config/redis';
import logger from '@shared/utils/logger';
import { REVERSAL_QUEUE_NAME, reversalQueue, ReversalCheckJobData } from '../queues/reversal.queue';
import { reversalService } from '../services/reversal.service';

const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 30_000;

export function startReversalWorker(): Worker<ReversalCheckJobData> {
  const worker = new Worker<ReversalCheckJobData>(
    REVERSAL_QUEUE_NAME,
    async (job) => {
      const { reference, providerReference, route, userId, amount, attempt, initiatedAt } = job.data;

      const result = await reversalService.checkAndReverseIfNeeded({
        reference,
        providerReference,
        route,
        userId,
        amount,
        initiatedAt: new Date(initiatedAt),
      });

      if (result.action === 'retry' && attempt < MAX_ATTEMPTS) {
        await reversalQueue.add(
          REVERSAL_QUEUE_NAME,
          { reference, providerReference, route, userId, amount, attempt: attempt + 1, initiatedAt },
          { delay: RETRY_DELAY_MS, removeOnComplete: true, removeOnFail: false }
        );
      }
    },
    { connection: redis }
  );

  worker.on('completed', (job) => {
    logger.debug(`[reversal-worker] job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[reversal-worker] job ${job?.id} failed: ${err.message}`);
  });

  logger.info('[reversal-worker] started, listening for reversal-check jobs');
  return worker;
}