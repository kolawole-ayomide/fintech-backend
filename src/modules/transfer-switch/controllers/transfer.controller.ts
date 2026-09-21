import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '@shared/errors/AppError';
import { transferService } from '../services/transfer.service';

const initiateTransferSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive(),
  sourceAccountId: z.string(),
  destinationBankCode: z.string().length(6),
  destinationAccountNumber: z.string().length(10),
  narration: z.string().max(100).optional(),
  idempotencyKey: z.string().uuid(),
});

const nameEnquirySchema = z.object({
  accountNumber: z.string().length(10),
  bankCode: z.string().length(6),
});

export class TransferController {
  async initiate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = initiateTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const result = await transferService.initiateTransfer({
        ...parsed.data,
        currency: 'NGN',
      });

      res.status(202).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async nameEnquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = nameEnquirySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const result = await transferService.nameEnquiry(
        parsed.data.accountNumber,
        parsed.data.bankCode
      );

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const transferController = new TransferController();