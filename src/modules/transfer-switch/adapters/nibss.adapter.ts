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
// Each entry tracks status + when it was created, so checkStatus can
// simulate a transaction settling (or dying) over a few seconds — giving
// the reversal-engine something real to react to during local dev.
interface MockTxn {
  status: TransferStatus;
  createdAt: number;
  willSettle: boolean; // decided once, at initiation
}

const mockTransactions = new Map<string, MockTxn>();

export class NibssAdapter implements TransferAdapter {
  async nameEnquiry(accountNumber: string, bankCode: string): Promise<NameEnquiryResult> {
    logger.debug(`[nibss] name enquiry: ${accountNumber} @ ${bankCode}`);
    await delay(300);
    return { accountNumber, accountName: 'MOCK ACCOUNT HOLDER', bankCode };
  }

  async initiateTransfer(input: InitiateTransferInput): Promise<TransferResult> {
    const providerReference = `NIBSS-${uuid()}`;
    logger.info(`[nibss] initiating transfer ${providerReference} for ${input.amount} NGN`);

    await delay(500);

    // ~90% of transfers are accepted for processing; the other ~10% fail immediately.
    const acceptedForProcessing = Math.random() > 0.1;
    // Of the ones accepted, ~70% will go on to settle within ~40s; the rest
    // stay stuck in "processing" so you can see the timeout-reversal path too.
    const willSettle = Math.random() > 0.3;

    const status: TransferStatus = acceptedForProcessing ? 'processing' : 'failed';

    mockTransactions.set(providerReference, { status, createdAt: Date.now(), willSettle });

    return {
      reference: input.idempotencyKey,
      route: 'nibss',
      status,
      providerReference,
      failureReason: acceptedForProcessing ? undefined : 'Mock upstream timeout',
    };
  }

  async checkStatus(providerReference: string): Promise<TransferStatus> {
    await delay(150);

    const txn = mockTransactions.get(providerReference);
    if (!txn) return 'processing';

    // Already resolved — return as-is.
    if (txn.status !== 'processing') return txn.status;

    const secondsElapsed = (Date.now() - txn.createdAt) / 1000;

    // Simulate settlement ~35-40s after initiation, for transactions marked to settle.
    if (txn.willSettle && secondsElapsed >= 35) {
      txn.status = 'settled';
    }

    return txn.status;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}