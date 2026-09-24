import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '@shared/errors/AppError';
import { vasService } from '../services/vas.service';

const categoryEnum = z.enum(['airtime', 'data', 'electricity', 'cable', 'betting', 'remita']);

const lookupSchema = z.object({
  category: categoryEnum,
  identifier: z.string().min(3),
});

const purchaseSchema = z.object({
  userId: z.string().uuid(),
  category: categoryEnum,
  identifier: z.string().min(3),
  amount: z.number().positive(),
  agentId: z.string().uuid().optional(),
  reference: z.string().uuid(),
});

export class VasController {
  async lookup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = lookupSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const result = await vasService.preDebitLookup(parsed.data);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async purchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = purchaseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const result = await vasService.purchase(parsed.data);
      res.status(202).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const vasController = new VasController();