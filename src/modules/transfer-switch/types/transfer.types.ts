export type TransferRouteName = 'paystack' | 'nibss' | 'direct_bank';

export type TransferStatus =
  | 'initiated'
  | 'pending_authorization'
  | 'processing'
  | 'settled'
  | 'failed'
  | 'reversed';

export interface InitiateTransferInput {
  userId: string;
  amount: number;
  currency: 'NGN';
  sourceAccountId: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  destinationAccountName?: string;
  narration?: string;
  idempotencyKey: string;
}

export interface TransferResult {
  reference: string;
  route: TransferRouteName;
  status: TransferStatus;
  providerReference?: string;
  failureReason?: string;
}

export interface NameEnquiryResult {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface TransferAdapter {
  nameEnquiry(accountNumber: string, bankCode: string): Promise<NameEnquiryResult>;
  initiateTransfer(input: InitiateTransferInput): Promise<TransferResult>;
  checkStatus(providerReference: string): Promise<TransferStatus>;
}