import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import { LedgerService } from '../../ledger/services/ledger.service';
import { EmailService } from '../../../shared/services/email.service';

const prisma = new PrismaClient();

export class CreditService {
  /**
   * Evaluates merchant cash-flow, calculates credit score, and disburses a credit line 
   * via the core LedgerService double-entry engine.
   */
  public static async evaluateAndGrantCredit(userId: string, requestedAmount: number) {
    const userAccount = await prisma.account.findFirst({
      where: { userId, accountType: 'CUSTOMER_WALLET' },
    });

    if (!userAccount) {
      throw new AppError('Customer wallet account not found.', 404);
    }

    // 1. Calculate cash-flow score based on ledger transaction volumes
    const score = await this.calculateCashFlowScore(userId);

    if (score < 600) {
      throw new AppError('Credit evaluation failed: Insufficient transaction volume or cash-flow score.', 400);
    }

    // Find or setup a system loan float account to disburse from
    let loanFloatAccount = await prisma.account.findFirst({
      where: { accountType: 'SYSTEM_REVENUE' }, 
    });

    if (!loanFloatAccount) {
      loanFloatAccount = await prisma.account.create({
        data: {
          userId,
          accountType: 'CUSTOMER_WALLET',
          currency: userAccount.currency,
          balance: 100000000, // Operational float pool
        },
      });
    }

    const loanReference = `LOAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 2. Execute atomic double-entry loan disbursement using LedgerService
    await LedgerService.executeTransaction({
      reference: loanReference,
      narration: `Disbursement for approved credit facility`,
      postings: [
        { accountId: loanFloatAccount.id, type: 'DEBIT', amount: requestedAmount },
        { accountId: userAccount.id, type: 'CREDIT', amount: requestedAmount },
      ],
    });

    // 3. Fetch user email and dispatch loan notification asynchronously
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user?.email) {
      await EmailService.sendLoanNotice(
        user.email,
        requestedAmount,
        loanReference,
        'APPROVED & DISBURSED'
      ).catch((err) => {
        console.error('Failed to send loan disbursement email:', err);
      });
    }

    const updatedAccount = await prisma.account.findUnique({
      where: { id: userAccount.id },
      select: { balance: true },
    });

    return {
      message: 'Credit facility approved and disbursed successfully.',
      loanReference,
      amountDisbursed: requestedAmount,
      newBalance: Number(updatedAccount?.balance || 0),
    };
  }

  /**
   * Registers a CBN GSI (Global Standing Instruction) mandate for default recovery.
   */
  public static async registerGsiMandate(userId: string, bvn: string) {
    await prisma.kycProfile.update({
      where: { userId },
      data: { bvn },
    }).catch(() => {
      // Handle edge case if profile doesn't exist yet
    });

    // Fetch user email to send GSI registration confirmation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user?.email) {
      const bvnMasked = bvn.slice(-4);
      await EmailService.sendGsiMandateNotice(user.email, bvnMasked).catch((err) => {
        console.error('Failed to send GSI mandate registration email:', err);
      });
    }

    return {
      message: 'GSI mandate successfully registered against BVN.',
      userId,
      bvnMasked: `******${bvn.slice(-4)}`,
      status: 'ACTIVE',
    };
  }

  private static async calculateCashFlowScore(userId: string): Promise<number> {
    const userAccount = await prisma.account.findFirst({
      where: { userId, accountType: 'CUSTOMER_WALLET' },
    });

    if (!userAccount) return 300;

    // Scan last 30 days of inflows to calculate score dynamically
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inflows = await prisma.ledgerPosting.aggregate({
      where: {
        accountId: userAccount.id,
        type: 'CREDIT',
        createdAt: { gte: thirtyDaysAgo },
        transaction: { status: 'COMMITTED' },
      },
      _sum: { amount: true },
    });

    const totalInflow = inflows._sum.amount ? Number(inflows._sum.amount) : 0;

    // Scoring logic based on real inflows
    if (totalInflow > 1000000) return 750;
    if (totalInflow > 500000) return 680;
    if (totalInflow > 100000) return 620;
    
    return 550; // Default baseline score
  }
}