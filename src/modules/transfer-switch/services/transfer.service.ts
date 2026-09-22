import { v4 as uuid } from 'uuid';
import logger from '@shared/utils/logger';
import { ledgerService } from '@modules/ledger/services/ledger.service';
import { NibssAdapter } from '../adapters/nibss.adapter';
import { PaystackAdapter } from '../adapters/paystack.adapter';
import { idempotencyService } from './idempotency.service';
import { routerService } from './router.service';
import { scheduleReversalCheck } from '@modules/reversal-engine/queues/reversal.queue';
import { InitiateTransferInput, TransferAdapter, TransferResult } from '../types/transfer.types';

const adapters: Record<string, TransferAdapter> = {
  paystack: new PaystackAdapter(),
  nibss: new NibssAdapter(), // kept for reference/fallback comparison, not actively routed to until real NIBSS creds exist
};

export class TransferService {
  async initiateTransfer(input: InitiateTransferInput): Promise<TransferResult> {
    await idempotencyService.acquireLock(input.idempotencyKey);
        let debitPosted = false;

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
      debitPosted = true;

      const result = await adapter.initiateTransfer(input);

      await routerService.recordOutcome(route, result.status !== 'failed');
      await idempotencyService.markCompleted(input.idempotencyKey, result.reference);

      if (result.status === 'failed') {
        // The adapter answered right away with a hard failure — there's
        // nothing to poll for, so credit the customer back immediately
        // instead of leaving the debit stranded.
        await ledgerService.postJournalEntry({
          reference: `${input.idempotencyKey}-reversal`,
          userId: input.userId,
          amount: input.amount,
          type: 'credit',
          account: 'customer_balance',
          description: `Reversal: ${result.failureReason ?? 'Transfer rejected immediately'}`,
        });
      } else if (result.providerReference) {
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
      if (debitPosted) {
        // Debit went through but the adapter call itself blew up (e.g.
        // Paystack 429/401) before we got a status back — same fix as
        // an immediate failure: credit the customer back right away.
        await ledgerService.postJournalEntry({
          reference: `${input.idempotencyKey}-reversal`,
          userId: input.userId,
          amount: input.amount,
          type: 'credit',
          account: 'customer_balance',
          description: `Reversal: transfer initiation threw — ${(err as Error).message}`,
        });
      }
      await idempotencyService.releaseLock(input.idempotencyKey);
      throw err;
    }
  }

  async nameEnquiry(accountNumber: string, bankCode: string) {
    const adapter = adapters.paystack;
    return adapter.nameEnquiry(accountNumber, bankCode);
  }

  generateIdempotencyKey(): string {
    return uuid();
  }
}

export const transferService = new TransferService();