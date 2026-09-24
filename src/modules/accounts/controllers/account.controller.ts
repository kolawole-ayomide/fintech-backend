import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../shared/middlewares/auth.middleware'; 
import { AccountService } from '../services/account.service';
import { PrismaClient, KycTier } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';

const prisma = new PrismaClient();

const TIER_LIMITS: Record<KycTier, { dailyLimit: number; maxBalance: number | null }> = {
  [KycTier.TIER_1]: { dailyLimit: 50000, maxBalance: 50000 },
  [KycTier.TIER_2]: { dailyLimit: 200000, maxBalance: 500000 },
  [KycTier.TIER_3]: { dailyLimit: 5000000, maxBalance: null },
};

export class AccountController {
  public static async createAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { currency, accountType } = req.body;
      const account = await AccountService.createAccount(userId, currency, accountType);

      res.status(201).json({
        status: 'success',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getMyAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const accounts = await AccountService.getUserAccounts(userId);

      res.status(200).json({
        status: 'success',
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const balanceInfo = await AccountService.getAccountBalance(id, userId);

      res.status(200).json({
        status: 'success',
        data: balanceInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetches the user's primary customer wallet balance along with active KYC tier limits.
   */
  public static async getAccountDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const account = await prisma.account.findFirst({
        where: { userId, accountType: 'CUSTOMER_WALLET' },
      });

      if (!account) {
        throw new AppError('Wallet account not found.', 404);
      }

      const kycProfile = await prisma.kycProfile.findUnique({
        where: { userId },
      });

      const currentTier = kycProfile?.tier || KycTier.TIER_1;
      const limits = TIER_LIMITS[currentTier];

      res.status(200).json({
        status: 'success',
        data: {
          accountNumber: account.id,
          balance: Number(account.balance),
          currency: account.currency,
          kyc: {
            tier: currentTier,
            status: kycProfile?.status || 'PENDING',
            dailyLimit: limits.dailyLimit,
            maxBalance: limits.maxBalance,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}