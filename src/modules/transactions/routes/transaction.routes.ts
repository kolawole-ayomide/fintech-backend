import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, KycTier } from '@prisma/client';
import { TransactionController } from '../controllers/transaction.controller';
import { AppError } from '../../../shared/errors/AppError';
import { authGuard } from '../../../shared/middlewares/authGuard';
import { transferLimiter } from '../../../shared/middlewares/rateLimiter';

const prisma = new PrismaClient();
const router = Router();

const TIER_LIMITS: Record<KycTier, { dailyLimit: number; maxBalance: number | null }> = {
  [KycTier.TIER_1]: { dailyLimit: 50000, maxBalance: 50000 },
  [KycTier.TIER_2]: { dailyLimit: 200000, maxBalance: 500000 },
  [KycTier.TIER_3]: { dailyLimit: 5000000, maxBalance: null },
};

function enforceKycLimits() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const { amount } = req.body;

      if (!userId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new AppError('A valid transaction amount is required.', 400);
      }

      const kycProfile = await prisma.kycProfile.findUnique({
        where: { userId },
      });

      const currentTier = kycProfile?.tier || KycTier.TIER_1;
      const limits = TIER_LIMITS[currentTier];

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const userAccount = await prisma.account.findFirst({
        where: { userId, accountType: 'CUSTOMER_WALLET' },
      });

      let totalSpentToday = 0;
      if (userAccount) {
        const postingsToday = await prisma.ledgerPosting.aggregate({
          where: {
            accountId: userAccount.id,
            type: 'DEBIT',
            createdAt: { gte: startOfDay },
            transaction: {
              status: 'COMMITTED',
            },
          },
          _sum: { amount: true },
        });
        totalSpentToday = postingsToday._sum.amount ? Number(postingsToday._sum.amount) : 0;
      }

      const projectedDailyTotal = totalSpentToday + amount;

      if (projectedDailyTotal > limits.dailyLimit) {
        throw new AppError(
          `Daily transaction limit exceeded for Tier ${currentTier.replace('TIER_', '')}. Limit is ${limits.dailyLimit.toLocaleString()}, you have already spent ${totalSpentToday.toLocaleString()} today.`,
          403
        );
      }

      if (limits.maxBalance !== null && userAccount) {
        const currentBalance = Number(userAccount.balance);
        const projectedBalance = currentBalance + amount;

        if (projectedBalance > limits.maxBalance) {
          throw new AppError(
            `Account max balance cap exceeded for Tier ${currentTier.replace('TIER_', '')}. Max allowed balance is ${limits.maxBalance.toLocaleString()}.`,
            403
          );
        }
      }

      (req as any).kycTier = currentTier;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Transfer route with KYC compliance checks
router.post('/transfer', authGuard, transferLimiter, enforceKycLimits(), TransactionController.processTransfer);

export default router;