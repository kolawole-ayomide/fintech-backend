import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import { LedgerService } from '../../ledger/services/ledger.service';
import { EmailService } from '../../../shared/services/email.service';

const prisma = new PrismaClient();

// Define a clear interface for the return shape
export interface TransferResult {
  reference: string;
  newBalance: number;
}

export class TransactionService {
  public static async processTransfer(
    senderUserId: string,
    recipientEmail: string,
    amount: number,
    narration?: string,
    idempotencyKey?: string
  ): Promise<TransferResult> {
    if (!recipientEmail || !amount || amount <= 0) {
      throw new AppError('Recipient email and a valid transfer amount are required.', 400);
    }

    if (!idempotencyKey) {
      throw new AppError('Idempotency key is required for financial transactions.', 400);
    }

    // 1. Check if this request was already processed successfully
    const existingKeyRecord = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existingKeyRecord) {
      return existingKeyRecord.response as unknown as TransferResult;
    }

    try {
      // 2. Find sender's customer wallet account
      const senderAccount = await prisma.account.findFirst({
        where: { userId: senderUserId, accountType: 'CUSTOMER_WALLET' },
      });

      if (!senderAccount) {
        throw new AppError('Sender wallet account not found.', 404);
      }

      if (Number(senderAccount.balance) < amount) {
        throw new AppError('Insufficient funds.', 400);
      }

      // 3. Enforce KYC Tier Single Transaction Limits
      const kycProfile = await prisma.kycProfile.findUnique({
        where: { userId: senderUserId },
      });

      if (!kycProfile) {
        throw new AppError('KYC profile not found. Please complete verification.', 403);
      }

      const KYC_LIMITS: Record<string, { maxSingle: number }> = {
        TIER_1: { maxSingle: 50000.00 },
        TIER_2: { maxSingle: 500000.00 },
        TIER_3: { maxSingle: Number.MAX_SAFE_INTEGER }, // Unlimited
      };

      const tierLimits = KYC_LIMITS[kycProfile.tier] || KYC_LIMITS.TIER_1;

      if (amount > tierLimits.maxSingle) {
        throw new AppError(
          `Amount exceeds your ${kycProfile.tier} single transaction limit of ₦${tierLimits.maxSingle.toLocaleString()}. Please upgrade your KYC tier.`,
          403
        );
      }

      // 4. Find recipient user and their wallet account
      const recipientUser = await prisma.user.findUnique({
        where: { email: recipientEmail },
      });

      if (!recipientUser) {
        throw new AppError('Recipient account not found.', 404);
      }

      if (senderUserId === recipientUser.id) {
        throw new AppError('You cannot transfer funds to yourself.', 400);
      }

      const recipientAccount = await prisma.account.findFirst({
        where: { userId: recipientUser.id, accountType: 'CUSTOMER_WALLET' },
      });

      if (!recipientAccount) {
        throw new AppError('Recipient destination wallet is inactive or missing.', 404);
      }

      // 5. Execute transfer via the core Ledger module interface
      const transferReference = `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      await LedgerService.executeTransaction({
        reference: transferReference,
        narration: narration || `Transfer to ${recipientEmail}`,
        postings: [
          { accountId: senderAccount.id, type: 'DEBIT', amount },
          { accountId: recipientAccount.id, type: 'CREDIT', amount },
        ],
      });

      // Send email notifications to both parties asynchronously
      const senderUser = await prisma.user.findUnique({
        where: { id: senderUserId },
        select: { email: true },
      });

      if (senderUser?.email) {
        EmailService.sendTransactionNotification(senderUser.email, 'DEBIT', amount, transferReference).catch((err) =>
          console.error('Failed to send sender email notification:', err)
        );
      }

      if (recipientUser.email) {
        EmailService.sendTransactionNotification(recipientUser.email, 'CREDIT', amount, transferReference).catch((err) =>
          console.error('Failed to send recipient email notification:', err)
        );
      }

      // 6. Fetch updated sender balance to return in response
      const updatedSender = await prisma.account.findUnique({
        where: { id: senderAccount.id },
        select: { balance: true },
      });

      const responsePayload: TransferResult = {
        reference: transferReference,
        newBalance: Number(updatedSender?.balance || 0),
      };

      // 7. Save the successful response to the IdempotencyKey table
      await prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          statusCode: 200,
          response: responsePayload as any,
        },
      });

      return responsePayload;

    } catch (error: any) {
      // 8. Handle race conditions: if duplicate requests hit at the exact same millisecond
      if (error.code === 'P2002') {
        const savedRecord = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });
        if (savedRecord) {
          return savedRecord.response as unknown as TransferResult;
        }
      }
      throw error;
    }
  }
}