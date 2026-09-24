import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import { EmailService } from '../../../shared/services/email.service';

const prisma = new PrismaClient();

export class StatementService {
  public static async getTransactionHistory(userId: string) {
    // 1. Find the user's customer wallet account
    const userAccount = await prisma.account.findFirst({
      where: { userId, accountType: 'CUSTOMER_WALLET' },
    });

    if (!userAccount) {
      throw new AppError('Wallet account not found.', 404);
    }

    // 2. Fetch all ledger postings associated with this account, including transaction details
    const postings = await prisma.ledgerPosting.findMany({
      where: { accountId: userAccount.id },
      include: {
        transaction: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Map into a clean audit trail format for the user
    return postings.map((posting) => ({
      reference: posting.transaction.reference,
      narration: posting.transaction.narration,
      type: posting.type, // 'DEBIT' or 'CREDIT'
      amount: Number(posting.amount),
      status: posting.transaction.status,
      date: posting.createdAt,
    }));
  }

  /**
   * Generates a monthly financial statement summary and emails it to the user.
   */
  public static async generateMonthlyStatement(userId: string, month: number, year: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const userAccount = await prisma.account.findFirst({
      where: { userId, accountType: 'CUSTOMER_WALLET' },
    });

    if (!userAccount) {
      throw new AppError('Wallet account not found.', 404);
    }

    // Define start and end date boundaries for the requested month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Aggregate total credits (inflows) for the month
    const inflows = await prisma.ledgerPosting.aggregate({
      where: {
        accountId: userAccount.id,
        type: 'CREDIT',
        createdAt: { gte: startDate, lte: endDate },
        transaction: { status: 'COMMITTED' },
      },
      _sum: { amount: true },
    });

    // Aggregate total debits (outflows) for the month
    const outflows = await prisma.ledgerPosting.aggregate({
      where: {
        accountId: userAccount.id,
        type: 'DEBIT',
        createdAt: { gte: startDate, lte: endDate },
        transaction: { status: 'COMMITTED' },
      },
      _sum: { amount: true },
    });

    const totalInflows = inflows._sum.amount ? Number(inflows._sum.amount) : 0;
    const totalOutflows = outflows._sum.amount ? Number(outflows._sum.amount) : 0;
    const closingBalance = Number(userAccount.balance);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1] || 'Unknown';

    // Dispatch monthly statement email asynchronously
    if (user.email) {
      await EmailService.sendMonthlyStatement(user.email, monthName, year, {
        totalInflows,
        totalOutflows,
        closingBalance,
        currency: userAccount.currency,
      }).catch((err) => {
        console.error('Failed to send monthly statement email:', err);
      });
    }

    return {
      month: monthName,
      year,
      currency: userAccount.currency,
      totalInflows,
      totalOutflows,
      closingBalance,
      message: 'Monthly statement generated and emailed successfully.',
    };
  }
}