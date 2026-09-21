import { v4 as uuid } from 'uuid';
import logger from '@shared/utils/logger';
import {
  InitiateTransferInput,
  NameEnquiryResult,
  TransferAdapter,
  TransferResult,
  TransferStatus,
} from '../types/transfer.types';

// Mock in-memory store standing in for NIBSS's real transaction state.
// Swap this adapter's internals for real HTTP calls once sandbox creds land —
// the TransferAdapter interface stays the same, so router.service.ts never changes.
const mockTransactions = new Map<string, TransferStatus>();

export class NibssAdapter implements TransferAdapter {
  async nameEnquiry(accountNumber: string, bankCode: string): Promise<NameEnquiryResult> {
    logger.debug(`[nibss] name enquiry: ${accountNumber} @ ${bankCode}`);

    // Simulated latency
    await delay(300);

    return {
      accountNumber,
      accountName: 'MOCK ACCOUNT HOLDER',
      bankCode,
    };
  }

  async initiateTransfer(input: InitiateTransferInput): Promise<TransferResult> {
    const providerReference = `NIBSS-${uuid()}`;
    logger.info(`[nibss] initiating transfer ${providerReference} for ${input.amount} NGN`);

    await delay(500);

    // Simulate ~90% success rate so router.service.ts has real variance to work with
    const success = Math.random() > 0.1;
    const status: TransferStatus = success ? 'processing' : 'failed';

    mockTransactions.set(providerReference, status);

    return {
      reference: input.idempotencyKey,
      route: 'nibss',
      status,
      providerReference,
      failureReason: success ? undefined : 'Mock upstream timeout',
    };
  }

  async checkStatus(providerReference: string): Promise<TransferStatus> {
    await delay(150);
    return mockTransactions.get(providerReference) ?? 'processing';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}