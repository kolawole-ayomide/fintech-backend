import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '@shared/errors/AppError';
import { virtualAccountService } from '../services/virtual-account.service';
import { dvaAdapter } from '../adapters/dva.adapter';

const provisionSchema = z.object({
  userId: z.string().uuid(),
  accountName: z.string().min(2),
  provider: z.enum(['wema', 'providus', 'sterling']).optional(),
});

const webhookSchema = z.object({
  nuban: z.string().length(10),
  amount: z.number().positive(),
  sessionId: z.string().min(1),
  narration: z.string().optional(),
  paidAt: z.string(),
});

export class VirtualAccountController {
  async provision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = provisionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const account = await virtualAccountService.provisionAccount(parsed.data);
      res.status(201).json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  }

  async getForUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const account = await virtualAccountService.getByUserId(userId);
      res.status(200).json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  }

  async handleDepositWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.header('x-webhook-signature');
      const rawBody = JSON.stringify(req.body);

      if (!dvaAdapter.verifyWebhookSignature(rawBody, signature)) {
        res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        return;
      }

      const parsed = webhookSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const result = await virtualAccountService.handleDepositWebhook(parsed.data);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const virtualAccountController = new VirtualAccountController();