import { v4 as uuid } from 'uuid';
import logger from '@shared/utils/logger';
import { ledgerService } from '@modules/ledger/services/ledger.service';
import { NibssAdapter } from '../adapters/nibss.adapter';
import { idempotencyService } from './idempotency.service';
import { routerService } from './router.service';
import { scheduleReversalCheck } from '@modules/reversal-engine/queues/reversal.queue';
import { InitiateTransferInput, TransferAdapter, TransferResult } from '../types/transfer.types';

const adapters: Record<string, TransferAdapter> = {
  nibss: new NibssAdapter(),
};

export class TransferService {
  async initiateTransfer(input: InitiateTransferInput): Promise<TransferResult> {
    await idempotencyService.acquireLock(input.idempotencyKey);

    try {
      const route = await routerService.selectRoute();
      const adapter = adapters[route];

      if (!adapter) {
        throw new Error(`No adapter registered for route: ${route}`);
      }

      logger.info(`[transfer] routing ${input.idempotencyKey} via ${route}`);

      await ledgerService.postJournalEntry({
        reference: input.idempotencyKey,
        userId: input.userId,
        amount: input.amount,
        type: 'debit',
        account: 'customer_balance',
        description: `Transfer to ${input.destinationAccountNumber}`,
      });

      const result = await adapter.initiateTransfer(input);

      await routerService.recordOutcome(route, result.status !== 'failed');
      await idempotencyService.markCompleted(input.idempotencyKey, result.reference);

      // Schedule the reversal-engine to watch this transfer and auto-credit
      // the customer back if it fails or times out (sub-10-min guarantee).
      if (result.status !== 'failed' && result.providerReference) {
        await scheduleReversalCheck({
          reference: result.reference,
          providerReference: result.providerReference,
          route,
          userId: input.userId,
          amount: input.amount,
        });
      }

      return result;
    } catch (err) {
      await idempotencyService.releaseLock(input.idempotencyKey);
      throw err;
    }
  }

  async nameEnquiry(accountNumber: string, bankCode: string) {
    const adapter = adapters.nibss;
    return adapter.nameEnquiry(accountNumber, bankCode);
  }

  generateIdempotencyKey(): string {
    return uuid();
  }
}

export const transferService = new TransferService();