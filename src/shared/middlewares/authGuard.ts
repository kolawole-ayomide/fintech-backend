import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { Role } from '@prisma/client';

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  [key: string]: any;
}

// 1. Define and export AuthenticatedRequest with explicit typing for role and email
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
    [key: string]: any;
  };
  kycTier?: string;
}

export const authGuard = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new AppError('Internal server configuration error: JWT secret missing.', 500);
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // Attach all decoded user claims (userId, email, role) to req.user
    req.user = {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Invalid or expired token.', 401));
  }
};