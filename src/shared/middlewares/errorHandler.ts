import { NextFunction, Request, Response } from 'express';
import { AppError } from '@shared/errors/AppError';
import logger from '@shared/utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError && err.isOperational) {
    logger.warn(`[${req.method} ${req.originalUrl}] ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  logger.error(`[${req.method} ${req.originalUrl}] Unexpected error: ${err.message}`, {
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}