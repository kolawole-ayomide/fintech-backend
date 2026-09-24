import { Request, Response, NextFunction } from 'express';
import { verifyTier2, verifyTier3 } from '../services/kyc.service';
import { AppError } from '../../../shared/errors/AppError';

export class KycController {
  /**
   * Upgrades a user's KYC tier to Tier 2 using BVN or NIN verification.
   */
  public static async verifyTier2(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId; 
      const { identifier, type } = req.body;

      if (!userId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      if (!identifier || !type) {
        throw new AppError('Identifier (BVN/NIN) and type are required.', 400);
      }

      if (!['BVN', 'NIN'].includes(type.toUpperCase())) {
        throw new AppError('Invalid verification type. Must be either BVN or NIN.', 400);
      }

      const result = await verifyTier2(userId, identifier, type.toUpperCase());

      res.status(200).json({
        status: 'success',
        message: 'KYC upgraded to Tier 2 successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upgrades a user's KYC tier to Tier 3 using corporate CAC registration details.
   */
  public static async verifyTier3(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { cacNumber, businessName } = req.body;

      if (!userId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      if (!cacNumber || !businessName) {
        throw new AppError('CAC registration number and business name are required.', 400);
      }

      const result = await verifyTier3(userId, cacNumber, businessName);

      res.status(200).json({
        status: 'success',
        message: 'KYC upgraded to Tier 3 corporate successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}