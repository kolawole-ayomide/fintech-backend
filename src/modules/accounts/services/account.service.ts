import { prisma } from '../../../config/prisma';
import { AppError } from '../../../shared/errors/AppError';

export class AccountService {
  /**
   * Creates a new currency account for an authenticated user.
   */
  public static async createAccount(userId: string, currency: string = 'NGN', accountType: string = 'CUSTOMER_WALLET') {
    // Optional: Validate currency or account type if needed
    const account = await prisma.account.create({
      data: {
        userId,
        currency: currency.toUpperCase(),
        accountType,
        balance: 0.00,
      },
    });

    return account;
  }

  /**
   * Retrieves all accounts belonging to a specific user.
   */
  public static async getUserAccounts(userId: string) {
    return await prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        accountType: true,
        currency: true,
        balance: true,
        createdAt: true,
      },
    });
  }

  /**
   * Retrieves a specific account's balance, ensuring ownership.
   */
  public static async getAccountBalance(accountId: string, userId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new AppError('Account not found.', 404);
    }

    // Security check: ensure the account belongs to the requesting user
    if (account.userId !== userId) {
      throw new AppError('Unauthorized access to this account.', 403);
    }

    return {
      accountId: account.id,
      accountType: account.accountType,
      currency: account.currency,
      balance: account.balance,
    };
  }
}