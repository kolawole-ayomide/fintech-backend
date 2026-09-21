export interface PostJournalEntryInput {
  reference: string;
  userId: string;
  amount: number;
  type: 'debit' | 'credit';
  account: 'customer_balance' | 'operational_float' | 'settlement_pool' | 'fee_reserve';
  description?: string;
}

export interface ReverseTransactionInput {
  originalReference: string;
  reason: string;
}

export interface LedgerService {
  postJournalEntry(input: PostJournalEntryInput): Promise<{ entryId: string }>;
  reverseTransaction(input: ReverseTransactionInput): Promise<{ reversalEntryId: string }>;
  getBalance(userId: string): Promise<{ available: number; ledger: number }>;
}

// ── Mock implementation ──────────────────────────────────────────
// BE1 replaces this class with the real Prisma double-entry implementation.
// Everything importing `ledgerService` below keeps working unchanged once
// they do, since the interface shape doesn't change.
import logger from '@shared/utils/logger';
import { v4 as uuid } from 'uuid';

class MockLedgerService implements LedgerService {
  async postJournalEntry(input: PostJournalEntryInput): Promise<{ entryId: string }> {
    logger.info(`[ledger:mock] ${input.type} ${input.amount} on ${input.account} (${input.reference})`);
    return { entryId: uuid() };
  }

  async reverseTransaction(input: ReverseTransactionInput): Promise<{ reversalEntryId: string }> {
    logger.info(`[ledger:mock] reversing ${input.originalReference}: ${input.reason}`);
    return { reversalEntryId: uuid() };
  }

  async getBalance(userId: string): Promise<{ available: number; ledger: number }> {
    logger.debug(`[ledger:mock] balance lookup for ${userId}`);
    return { available: 0, ledger: 0 };
  }
}

export const ledgerService: LedgerService = new MockLedgerService();