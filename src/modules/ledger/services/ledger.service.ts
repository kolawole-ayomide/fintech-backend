import { prisma } from '../../../config/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/errors/AppError';

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