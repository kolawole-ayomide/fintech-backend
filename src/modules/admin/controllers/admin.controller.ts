import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../shared/middlewares/authGuard';
import { AdminService } from '../services/admin.service';
import { AppError } from '../../../shared/errors/AppError';
import { KycTier, KycStatus } from '@prisma/client';

export class AdminController {
  public static async getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const result = await AdminService.getUsers(page, limit);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateAccountStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!userId || !['ACTIVE', 'FROZEN'].includes(status)) {
        throw new AppError('Valid userId and status (ACTIVE or FROZEN) are required.', 400);
      }

      const result = await AdminService.toggleAccountStatus(userId, status);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async overrideKyc(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { tier, status, reason } = req.body;

      if (!userId || !tier || !status) {
        throw new AppError('userId, tier, and status are required for KYC override.', 400);
      }

      if (!Object.values(KycTier).includes(tier) || !Object.values(KycStatus).includes(status)) {
        throw new AppError('Invalid KycTier or KycStatus provided.', 400);
      }

      const result = await AdminService.overrideKycStatus(userId, tier, status, reason);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getSystemLedger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await AdminService.getSystemLedgerOverview();

      res.status(200).json({
        status: 'success',
        data: overview,
      });
    } catch (error) {
      next(error);
    }
  }
}