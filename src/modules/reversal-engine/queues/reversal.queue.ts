import { Queue } from 'bullmq';
import redis from '@config/redis';
import { TransferRouteName } from '@modules/transfer-switch/types/transfer.types';

export interface ReversalCheckJobData {
  reference: string;
  providerReference: string;
  route: TransferRouteName;
  userId: string;
  amount: number;
  initiatedAt: number; // epoch ms — carried across every retry, never recalculated
  attempt: number;
}

export const REVERSAL_QUEUE_NAME = 'reversal-check';

export const reversalQueue = new Queue<ReversalCheckJobData>(REVERSAL_QUEUE_NAME, {
  connection: redis,
});

export async function scheduleReversalCheck(
  data: Omit<ReversalCheckJobData, 'attempt' | 'initiatedAt'>,
  delayMs = 30_000
): Promise<void> {
  await reversalQueue.add(
    REVERSAL_QUEUE_NAME,
    { ...data, attempt: 1, initiatedAt: Date.now() },
    { delay: delayMs, removeOnComplete: true, removeOnFail: false }
  );
}