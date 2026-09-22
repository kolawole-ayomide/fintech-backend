import axios, { AxiosError } from 'axios';
import logger from '@shared/utils/logger';
import { AppError } from '@shared/errors/AppError';
import {
  InitiateTransferInput,
  NameEnquiryResult,
  TransferAdapter,
  TransferResult,
  TransferStatus,
} from '../types/transfer.types';

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? '';

const client = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Paystack test mode caps *live* bank-code resolves at 3/day — use bank
// code '001' (Paystack's dedicated test bank) for all local dev/testing
// to avoid burning that quota. A 429 from this adapter during testing is
// usually this quota, not a true rate limit — see handlePaystackError below.

function mapStatus(paystackStatus: string): TransferStatus {
  switch (paystackStatus) {
    case 'success':
      return 'settled';
    case 'failed':
    case 'reversed':
      return 'failed';
    case 'pending':
    case 'otp':
      return 'processing';
    default:
      return 'processing';
  }
}

// Surfaces Paystack-specific failures with useful, honest messages instead
// of letting axios's generic "Request failed with status code X" bubble up.
function handlePaystackError(err: unknown, context: string): never {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    const status = axiosErr.response?.status;
    const paystackMessage = axiosErr.response?.data?.message;

    if (status === 429) {
      logger.error(`[paystack] rate limited during ${context}`);
      throw new AppError('Paystack rate limit reached — please retry shortly', 429);
    }

    if (status === 401) {
      logger.error(`[paystack] auth failed during ${context} — check PAYSTACK_SECRET_KEY`);
      throw new AppError('Paystack authentication failed', 500, false);
    }

    logger.error(`[paystack] ${context} failed: ${paystackMessage ?? axiosErr.message}`);
    throw new AppError(paystackMessage ?? `Paystack request failed during ${context}`, status ?? 502);
  }

  logger.error(`[paystack] unexpected error during ${context}: ${(err as Error).message}`);
  throw err;
}

export class PaystackAdapter implements TransferAdapter {
  async nameEnquiry(accountNumber: string, bankCode: string): Promise<NameEnquiryResult> {
    logger.debug(`[paystack] resolving account ${accountNumber} @ bank ${bankCode}`);

    try {
      const { data } = await client.get('/bank/resolve', {
        params: { account_number: accountNumber, bank_code: bankCode },
      });

      return {
        accountNumber,
        accountName: data.data.account_name,
        bankCode,
      };
    } catch (err) {
      handlePaystackError(err, 'name enquiry');
    }
  }

  async initiateTransfer(input: InitiateTransferInput): Promise<TransferResult> {
    try {
      logger.info(`[paystack] creating transfer recipient for ${input.destinationAccountNumber}`);

      const recipientRes = await client.post('/transferrecipient', {
        type: 'nuban',
        name: input.destinationAccountName ?? 'Recipient',
        account_number: input.destinationAccountNumber,
        bank_code: input.destinationBankCode,
        currency: 'NGN',
      });

      const recipientCode = recipientRes.data.data.recipient_code;

      logger.info(`[paystack] initiating transfer ${input.idempotencyKey} for ${input.amount} NGN`);

      const transferRes = await client.post('/transfer', {
        source: 'balance',
        amount: Math.round(input.amount * 100),
        recipient: recipientCode,
        reason: input.narration ?? 'Transfer',
        reference: input.idempotencyKey,
      });

      const status = mapStatus(transferRes.data.data.status);

      return {
        reference: input.idempotencyKey,
        route: 'paystack',
        status,
        providerReference: transferRes.data.data.transfer_code,
        failureReason: status === 'failed' ? 'Paystack transfer failed' : undefined,
      };
    } catch (err) {
      handlePaystackError(err, 'transfer initiation');
    }
  }

  async checkStatus(providerReference: string): Promise<TransferStatus> {
    try {
      const { data } = await client.get(`/transfer/verify/${providerReference}`);
      return mapStatus(data.data.status);
    } catch (err) {
      handlePaystackError(err, 'status check');
    }
  }
}