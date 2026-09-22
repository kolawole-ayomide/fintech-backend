import prisma from '@config/database';
import logger from '@shared/utils/logger';
import { ledgerService } from '@modules/ledger/services/ledger.service';
import { idempotencyService } from '@modules/transfer-switch/services/idempotency.service';
import { failoverService } from './failover.service';
import { commissionService } from './commission.service';
import { PreDebitLookupInput, VasPurchaseInput, VasPurchaseResult } from '../types/vas.types';

export class VasService {
  async preDebitLookup(input: PreDebitLookupInput) {
    return failoverService.lookupWithFailover((adapter) => adapter.preDebitLookup(input));
  }

  async purchase(input: VasPurchaseInput): Promise<VasPurchaseResult> {
    await idempotencyService.acquireLock(input.reference);
    let debitPosted = false;

    try {
      // Debit the customer first — same debit-then-settle pattern as transfer-switch
      await ledgerService.postJournalEntry({
        reference: input.reference,
        userId: input.userId,
        amount: input.amount,
        type: 'debit',
        account: 'customer_balance',
        description: `${input.category} purchase (${input.identifier})`,
      });
      debitPosted = true;

      const result = await failoverService.purchaseWithFailover(input);

      await prisma.vasTransactionLog.create({
        data: {
          userId: input.userId,
          category: input.category,
          provider: result.provider,
          amount: input.amount,
          status: result.status,
          reference: input.reference,
        },
      });

      if (result.status === 'success') {
        await commissionService.splitAndCredit({
          reference: input.reference,
          amount: input.amount,
          agentId: input.agentId,
        });
      } else {
        // Purchase failed at the biller — refund the customer's debit
        await ledgerService.postJournalEntry({
          reference: `${input.reference}-refund`,
          userId: input.userId,
          amount: input.amount,
          type: 'credit',
          account: 'customer_balance',
          description: `Refund: ${result.failureReason ?? 'purchase failed'}`,
        });
      }

      await idempotencyService.markCompleted(input.reference, result.reference);
      return result;
    } catch (err) {
      if (debitPosted) {
        // Debit went through, but every aggregator in the failover chain
        // failed/timed out (or something else threw) before we got a
        // definitive status — same fix as transfer-switch: refund immediately
        // rather than leaving the customer's debit stranded.
        await ledgerService.postJournalEntry({
          reference: `${input.reference}-refund`,
          userId: input.userId,
          amount: input.amount,
          type: 'credit',
          account: 'customer_balance',
          description: `Refund: purchase failed entirely — ${(err as Error).message}`,
        });
      }
      await idempotencyService.releaseLock(input.reference);
      logger.error(`[vas] purchase failed entirely for ${input.reference}: ${(err as Error).message}`);
      throw err;
    }
  }
}

export const vasService = new VasService();