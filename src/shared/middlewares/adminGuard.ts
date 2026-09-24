import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authGuard';
import { AppError } from '../errors/AppError';
import { Role } from '@prisma/client';

export function adminGuard(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const userRole = req.user?.role;

    // Explicitly typed array prevents TypeScript tuple/includes inference errors
    const allowedRoles: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new AppError('Access forbidden: Administrative privileges required.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}