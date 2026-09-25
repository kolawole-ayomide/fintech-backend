import { prisma } from '../../../config/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/errors/AppError';
import { v4 as uuidGen } from 'uuid';

interface PostingInput {
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number | Decimal;
}

interface CreateTransactionInput {
  reference: string;
  narration: string;
  postings: PostingInput[];
}

export class LedgerService {
  /**
   * Executes a double-entry ledger transaction safely and atomically.
   * Ensures Sum(Debits) === Sum(Credits) and uses atomic database increments.
   */
  static async executeTransaction(input: CreateTransactionInput) {
    const { reference, narration, postings } = input;

    // 1. Calculate and validate double-entry balance rule
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const p of postings) {
      const amt = new Decimal(p.amount);
      if (amt.lte(0)) {
        throw new AppError('Posting amount must be greater than zero', 400);
      }
      if (p.type === 'DEBIT') {
        totalDebits = totalDebits.plus(amt);
      } else if (p.type === 'CREDIT') {
        totalCredits = totalCredits.plus(amt);
      } else {
        throw new AppError(`Invalid posting type: ${p.type}`, 400);
      }
    }

    if (!totalDebits.equals(totalCredits)) {
      throw new AppError(
        `Double-entry invariant violated: Total Debits (${totalDebits}) must equal Total Credits (${totalCredits})`,
        400
      );
    }

    // 2. Execute within a Prisma interactive transaction letting TS infer 'tx'
    return await prisma.$transaction(async (tx) => {
      // Create the ledger transaction record with its nested postings
      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          reference,
          narration,
          status: 'COMMITTED',
          postings: {
            create: postings.map((p) => ({
              accountId: p.accountId,
              type: p.type,
              amount: p.amount,
            })),
          },
        },
        include: {
          postings: true,
        },
      });

      // 3. Update balances atomically using database-level increments/decrements
      for (const p of postings) {
        const amt = new Decimal(p.amount);
        const balanceChange = p.type === 'CREDIT' ? amt : amt.negated();

        await tx.account.update({
          where: { id: p.accountId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        });
      }

      return ledgerTx;
    });
  }

  /**
   * Required by Backend 2's transfer-switch / routing engine.
   * Acts as a direct wrapper around executeTransaction.
   */
  static async postJournalEntry(input: CreateTransactionInput) {
    return this.executeTransaction(input);
  }

  /**
   * Required by Backend 2's reversal-engine.
   * Finds an original transaction and reverses all postings to refund/correct balances.
   */
  static async reverseTransaction(originalReference: string, newReference: string, narration: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Find the original transaction and its postings
      const originalTx = await tx.ledgerTransaction.findUnique({
        where: { reference: originalReference },
        include: { postings: true },
      });

      if (!originalTx) {
        throw new AppError(`Original transaction with reference ${originalReference} not found for reversal.`, 404);
      }

      if (originalTx.status === 'REVERSED') {
        throw new AppError(`Transaction ${originalReference} has already been reversed.`, 400);
      }

      // 2. Flip the postings (DEBIT becomes CREDIT, CREDIT becomes DEBIT)
      const reversedPostings: PostingInput[] = originalTx.postings.map((p) => ({
        accountId: p.accountId,
        type: p.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        amount: p.amount,
      }));

      // 3. Execute the reversal transaction
      const reversalTx = await tx.ledgerTransaction.create({
        data: {
          reference: newReference,
          narration: narration || `Reversal of ${originalReference}`,
          status: 'COMMITTED',
          postings: {
            create: reversedPostings.map((p) => ({
              accountId: p.accountId,
              type: p.type,
              amount: p.amount,
            })),
          },
        },
        include: { postings: true },
      });

      // 4. Update balances atomically for the reversed postings
      for (const p of reversedPostings) {
        const amt = new Decimal(p.amount);
        const balanceChange = p.type === 'CREDIT' ? amt : amt.negated();

        await tx.account.update({
          where: { id: p.accountId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        });
      }

      // 5. Mark original transaction as reversed
      await tx.ledgerTransaction.update({
        where: { reference: originalReference },
        data: { status: 'REVERSED' },
      });

      return reversalTx;
    });
  }

  static async getAccountBalance(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, accountType: true, balance: true, currency: true },
    });
    if (!account) throw new AppError('Account not found', 404);
    return account;
  }

  /**
   * Retrieves all ledger transactions involving any of a user's accounts.
   */
  static async getUserTransactions(userId: string) {
    const userAccounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    const accountIds = userAccounts.map((acc) => acc.id);

    if (accountIds.length === 0) {
      return [];
    }

    return await prisma.ledgerTransaction.findMany({
      where: {
        postings: {
          some: {
            accountId: {
              in: accountIds,
            },
          },
        },
      },
      include: {
        postings: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────
// BE2 compatibility adapter — bridges the single-sided debit/
// credit calls used by transfer-switch, reversal-engine, vas,
// virtual-accounts and tms into real, balanced double-entry
// postings against LedgerService above. Nothing above this line
// was changed.
//
// Design note: none of the BE2 call sites know their transaction's
// counterparty account, so each single-sided call posts its stated
// leg against the named account, and the balancing leg against a
// system CLEARING account. This keeps every transaction genuinely
// balanced (debits == credits) without rewriting five modules'
// call sites. A CLEARING account is a standard accounting pattern
// for money in transit — safe as a default, worth revisiting once
// real settlement flows are defined.
// ─────────────────────────────────────────────────────────────

type LegacyAccountLabel = 'customer_balance' | 'operational_float' | 'settlement_pool' | 'fee_reserve';

const ACCOUNT_TYPE_MAP: Record<LegacyAccountLabel, string> = {
  customer_balance: 'CUSTOMER_WALLET',
  operational_float: 'FLOAT',
  settlement_pool: 'SETTLEMENT',
  fee_reserve: 'FEE_RESERVE',
};

async function getOrCreateAccount(userId: string | null, accountType: string) {
  const isSystemAccount = accountType !== 'CUSTOMER_WALLET';
  const where = isSystemAccount
    ? { accountType, userId: null }
    : { accountType, userId: userId as string };

  const existing = await prisma.account.findFirst({ where });
  if (existing) return existing;

  return prisma.account.create({
    data: {
      userId: isSystemAccount ? null : userId,
      accountType,
      currency: 'NGN',
      balance: 0,
    },
  });
}

export interface PostJournalEntryInput {
  reference: string;
  userId: string;
  amount: number;
  type: 'debit' | 'credit';
  account: LegacyAccountLabel;
  description?: string;
}

export interface ReverseTransactionInput {
  originalReference: string;
  reason: string;
}

class LedgerServiceAdapter {
  async postJournalEntry(input: PostJournalEntryInput): Promise<{ entryId: string }> {
    const mappedType = ACCOUNT_TYPE_MAP[input.account];
    const isSystemLeg = mappedType !== 'CUSTOMER_WALLET';

    const primaryAccount = await getOrCreateAccount(isSystemLeg ? null : input.userId, mappedType);
    const clearingAccount = await getOrCreateAccount(null, 'CLEARING');

    const primaryPostingType = input.type === 'debit' ? 'DEBIT' : 'CREDIT';
    const clearingPostingType = input.type === 'debit' ? 'CREDIT' : 'DEBIT';

    const result = await LedgerService.executeTransaction({
      reference: input.reference,
      narration: input.description ?? '',
      postings: [
        { accountId: primaryAccount.id, type: primaryPostingType as 'DEBIT' | 'CREDIT', amount: input.amount },
        { accountId: clearingAccount.id, type: clearingPostingType as 'DEBIT' | 'CREDIT', amount: input.amount },
      ],
    });

    return { entryId: result.id };
  }

  async reverseTransaction(input: ReverseTransactionInput): Promise<{ reversalEntryId: string }> {
    const newReference = `${input.originalReference}-reversal-${uuidGen()}`;
    const result = await LedgerService.reverseTransaction(input.originalReference, newReference, input.reason);
    return { reversalEntryId: result.id };
  }

  async getBalance(userId: string): Promise<{ available: number; ledger: number }> {
    const account = await getOrCreateAccount(userId, 'CUSTOMER_WALLET');
    const balanceInfo = await LedgerService.getAccountBalance(account.id);
    const balance = Number(balanceInfo.balance);
    return { available: balance, ledger: balance };
  }
}

export const ledgerService = new LedgerServiceAdapter();