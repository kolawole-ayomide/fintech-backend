import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma'; // Make sure this path points correctly to your prisma client

export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    next();
    return;
  }

  try {
    // 1. Check if this key has already been processed
    const existingRecord = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existingRecord) {
      // Return the cached response safely
      res.status(existingRecord.statusCode).json(existingRecord.response);
      return;
    }

    // 2. Intercept `res.json` to capture the output response before sending it to the client
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Save the response asynchronously for future retries
      prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          response: body,
          statusCode: res.statusCode,
        },
      }).catch((err) => {
        console.error('Failed to save idempotency key cache:', err);
      });

      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};