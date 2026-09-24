import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../shared/middlewares/authGuard';
import { CreditService } from '../services/credit.service';
import { AppError } from '../../../shared/errors/AppError';

export class CreditController {
  public static async requestCredit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { amount } = req.body;

      if (!userId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      if (!amount || amount <= 0) {
        throw new AppError('A valid loan request amount is required.', 400);
      }

      const result = await CreditService.evaluateAndGrantCredit(userId, Number(amount));

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async setupGsi(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { bvn } = req.body;

      if (!userId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      if (!bvn || bvn.length !== 11) {
        throw new AppError('A valid 11-digit BVN is required for GSI mandate activation.', 400);
      }

      const result = await CreditService.registerGsiMandate(userId, bvn);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}