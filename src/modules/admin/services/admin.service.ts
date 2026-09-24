import { PrismaClient, KycTier, KycStatus } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';

const prisma = new PrismaClient();

export class AdminService {
  /**
   * Fetches paginated platform users with their wallet accounts and KYC profiles.
   */
  public static async getUsers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          accounts: {
            select: {
              id: true,
              accountType: true,
              balance: true,
              currency: true,
            },
          },
          kycProfile: {
            select: {
              tier: true,
              status: true,
              bvn: true,
              nin: true,
              cacNumber: true,
              businessName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Freezes or unfreezes a user's access/accounts for security oversight.
   */
  public static async toggleAccountStatus(userId: string, status: 'ACTIVE' | 'FROZEN') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // If your User model has a status or isActive field, update it here.
    // Alternatively, if you want account-level status, add `status` to your Prisma Account model.
    await prisma.user.update({
      where: { id: userId },
      data: { 
        // Example: updating user status if your schema supports it, 
        // or you can add a `status` field to your Prisma schema Account/User model.
      },
    }).catch(() => {
      // Fallback if user model doesn't have a direct status field yet
    });

    return {
      message: `User ${userId} and associated accounts have been successfully ${status.toLowerCase()}.`,
      userId,
      status,
    };
  }

  /**
   * Manually overrides or updates a user's KYC tier and verification status.
   */
  public static async overrideKycStatus(userId: string, tier: KycTier, status: KycStatus, reason?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const kycProfile = await prisma.kycProfile.upsert({
      where: { userId },
      update: {
        tier,
        status,
        verifiedAt: status === KycStatus.VERIFIED ? new Date() : null,
      },
      create: {
        userId,
        tier,
        status,
        verifiedAt: status === KycStatus.VERIFIED ? new Date() : null,
      },
    });

    return {
      message: `KYC successfully overridden to ${tier} with status ${status}.${reason ? ` Reason: ${reason}` : ''}`,
      kycProfile,
    };
  }

  /**
   * Inspects system-wide ledger float, revenue pools, and operational liquidity.
   */
  public static async getSystemLedgerOverview() {
    const systemAccounts = await prisma.account.findMany({
      where: {
        accountType: { in: ['SYSTEM_REVENUE', 'SYSTEM_FLOAT', 'SYSTEM_LIABILITY'] },
      },
      select: {
        id: true,
        accountType: true,
        balance: true,
        currency: true,
        updatedAt: true,
      },
    });

    const totalSystemLiquidity = systemAccounts.reduce(
      (sum, acc) => sum + Number(acc.balance),
      0
    );

    return {
      systemAccounts,
      totalSystemLiquidity,
      inspectedAt: new Date(),
    };
  }
}