import prisma from '@config/database';
import logger from '@shared/utils/logger';
import { ConflictError, NotFoundError } from '@shared/errors/AppError';
import { ledgerService } from '@modules/ledger/services/ledger.service';
import { idempotencyService } from '@modules/transfer-switch/services/idempotency.service';
import { dvaAdapter } from '../adapters/dva.adapter';
import { DvaWebhookPayload, ProvisionVirtualAccountInput } from '../types/virtual-account.types';

export class VirtualAccountService {
  async provisionAccount(input: ProvisionVirtualAccountInput) {
    const existing = await prisma.virtualAccount.findFirst({
      where: { userId: input.userId, isActive: true },
    });

    if (existing) {
      logger.info(`[virtual-accounts] user ${input.userId} already has an active NUBAN`);
      return existing;
    }

    const provisioned = await dvaAdapter.provisionAccount(input);

    const record = await prisma.virtualAccount.create({
      data: {
        userId: input.userId,
        nuban: provisioned.nuban,
        bankName: provisioned.bankName,
        provider: provisioned.provider,
      },
    });

    logger.info(`[virtual-accounts] provisioned ${record.nuban} (${record.bankName}) for user ${input.userId}`);
    return record;
  }

  async getByUserId(userId: string) {
    const account = await prisma.virtualAccount.findFirst({
      where: { userId, isActive: true },
    });

    if (!account) {
      throw new NotFoundError('No active virtual account found for this user');
    }

    return account;
  }

  /**
   * Handles an inbound deposit webhook. Idempotent on the provider's
   * sessionId — a partner bank retrying the same webhook (common with
   * at-least-once delivery) will never double-credit the customer.
   */
  async handleDepositWebhook(payload: DvaWebhookPayload) {
    const idempotencyKey = `dva-webhook:${payload.sessionId}`;

    try {
      await idempotencyService.acquireLock(idempotencyKey);
    } catch {
      logger.warn(`[virtual-accounts] duplicate webhook ignored: ${payload.sessionId}`);
      return { duplicate: true };
    }

    const account = await prisma.virtualAccount.findUnique({
      where: { nuban: payload.nuban },
    });

    if (!account) {
      await idempotencyService.releaseLock(idempotencyKey);
      throw new NotFoundError(`No virtual account found for NUBAN ${payload.nuban}`);
    }

    await ledgerService.postJournalEntry({
      reference: payload.sessionId,
      userId: account.userId,
      amount: payload.amount,
      type: 'credit',
      account: 'customer_balance',
      description: payload.narration ?? `Deposit via ${account.bankName} (${payload.nuban})`,
    });

    await idempotencyService.markCompleted(idempotencyKey, payload.sessionId);

    logger.info(`[virtual-accounts] credited ${payload.amount} to user ${account.userId} via ${payload.nuban}`);
    return { duplicate: false, userId: account.userId };
  }
}

export const virtualAccountService = new VirtualAccountService();