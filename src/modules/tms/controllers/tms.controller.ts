import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '@shared/errors/AppError';
import { tmsService } from '../services/tms.service';

const heartbeatSchema = z.object({
  terminalId: z.string().min(3),
  model: z.enum(['sunmi', 'telpo', 'pax']),
  batteryLevel: z.number().min(0).max(100).optional(),
  signalStrength: z.number().optional(),
});

const transactionSchema = z.object({
  terminalId: z.string().min(3),
  agentId: z.string().uuid(),
  amount: z.number().positive(),
  cardMaskedPan: z.string().min(10),
  reference: z.string().uuid(),
});

export class TmsController {
  async heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = heartbeatSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }
      const session = await tmsService.recordHeartbeat(parsed.data);
      res.status(200).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }

  async transaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = transactionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }
      const result = await tmsService.processTransaction(parsed.data);
      res.status(202).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async listOnline(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const terminals = await tmsService.listOnlineTerminals();
      res.status(200).json({ success: true, data: terminals });
    } catch (err) {
      next(err);
    }
  }
}

export const tmsController = new TmsController();