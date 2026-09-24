import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../../../shared/errors/AppError';
import { config } from '../../../config/env.config';
import { EmailService } from '../../../shared/services/email.service';

const prisma = new PrismaClient();

export class AuthService {
  /**
   * Registers a new user and provisions a default NGN customer wallet account 
   * and a default TIER_1 KYC profile.
   */
  public static async register(email: string, password: string) {
    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists.', 409);
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create user, initial ledger account, and KYC profile inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      // Automatically create a default CUSTOMER_WALLET account for the ledger
      await tx.account.create({
        data: {
          userId: user.id,
          accountType: 'CUSTOMER_WALLET',
          balance: 0.00,
          currency: 'NGN',
        },
      });

      // Automatically initialize default Tier 1 KYC profile for compliance limits
      await tx.kycProfile.create({
        data: {
          userId: user.id,
          tier: 'TIER_1',
          status: 'PENDING',
        },
      });

      return user;
    });

    // 4. Send welcome/verification OTP email asynchronously
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await EmailService.sendAuthOtp(email, otpCode).catch((err) => {
      console.error('Failed to send registration verification email:', err);
    });

    // 5. Generate JWT Token using centralized config
    const token = jwt.sign(
      { 
        userId: result.id, 
        email: result.email, 
        role: result.role 
      }, 
      config.jwtSecret, 
      { expiresIn: config.jwtExpiresIn as any }
    );

    return { 
      user: { 
        id: result.id, 
        email: result.email, 
        role: result.role 
      }, 
      token 
    };
  }

  /**
   * Authenticates an existing user and returns a JWT token.
   */
  public static async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Active password verification against stored database password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Send new login / device security alert email asynchronously
    EmailService.sendNewLoginAlert(email, ipAddress, userAgent).catch((err) => {
      console.error('Failed to send new login security alert email:', err);
    });

    // Generate token including role
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role // <-- Added role here for login tokens too!
      }, 
      config.jwtSecret, 
      { expiresIn: config.jwtExpiresIn as any }
    );

    return { 
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role // <-- Included role in response 
      }, 
      token 
    };
  }

  /**
   * Initiates the forgot password flow by generating a reset token/OTP and emailing it.
   */
  public static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'If an account with that email exists, a password reset code has been sent.' };
    }

    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await EmailService.sendAuthOtp(email, resetOtp).catch((err) => {
      console.error('Failed to send password reset email:', err);
      throw new AppError('Failed to send password reset email. Please try again later.', 500);
    });

    return { message: 'Password reset code successfully sent to email.' };
  }

  /**
   * Resets the user password using the verification token/OTP.
   */
  public static async resetPassword(email: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError('User account not found.', 404);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return { message: 'Password successfully reset. You can now login with your new password.' };
  }
}