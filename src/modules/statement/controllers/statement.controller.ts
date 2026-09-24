import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../shared/middlewares/auth.middleware'; // or your shared auth request type
import { StatementService } from '../services/statement.service';
import { AppError } from '../../../shared/errors/AppError';

export class StatementController {
  public static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      const history = await StatementService.getTransactionHistory(userId);

      res.status(200).json({
        status: 'success',
        results: history.length,
        data: { history },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getMonthlyStatement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { month, year } = req.query;

      if (!userId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      const targetMonth = month ? Number(month) : new Date().getMonth() + 1;
      const targetYear = year ? Number(year) : new Date().getFullYear();

      const statement = await StatementService.generateMonthlyStatement(userId, targetMonth, targetYear);

      res.status(200).json({
        status: 'success',
        data: statement,
      });
    } catch (error) {
      next(error);
    }
  }
}