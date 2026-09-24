import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../shared/middlewares/auth.middleware';
import { TransactionService } from '../services/transaction.service';
import { AppError } from '../../../shared/errors/AppError';

export class TransactionController {
  public static async processTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const senderUserId = req.user?.userId;
      if (!senderUserId) {
        throw new AppError('Unauthorized user context missing.', 401);
      }

      // Extract idempotencyKey from either body or headers
      const { recipientEmail, amount, narration, idempotencyKey: bodyKey } = req.body;
      const idempotencyKey = bodyKey || (req.headers['idempotency-key'] as string) || (req.headers['x-idempotency-key'] as string);

      const result = await TransactionService.processTransfer(
        senderUserId,
        recipientEmail,
        Number(amount),
        narration,
        idempotencyKey // Now passing it correctly!
      );

      res.status(201).json({
        status: 'success',
        message: 'Transfer completed successfully',
        data: {
          reference: result.reference,
          amountTransferred: Number(amount),
          newBalance: result.newBalance,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}