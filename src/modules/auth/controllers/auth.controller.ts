import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.register(email, password);

      return res.status(201).json({
        status: 'success',
        message: 'User registered successfully and wallet provisioned.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      
      // Capture client IP and device/browser user-agent for security alerts
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login(email, password, ipAddress, userAgent);

      return res.status(200).json({
        status: 'success',
        message: 'Login successful.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);

      return res.status(200).json({
        status: 'success',
        message: 'Password reset code sent successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, newPassword } = req.body;
      const result = await AuthService.resetPassword(email, newPassword);

      return res.status(200).json({
        status: 'success',
        message: 'Password reset successful.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}