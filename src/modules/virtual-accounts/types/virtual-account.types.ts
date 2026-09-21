export type DvaProvider = 'wema' | 'providus' | 'sterling';

export interface ProvisionVirtualAccountInput {
  userId: string;
  accountName: string;
  provider?: DvaProvider; // optional — service picks a default if omitted
}

export interface ProvisionedVirtualAccount {
  nuban: string;
  bankName: string;
  provider: DvaProvider;
}

export interface DvaWebhookPayload {
  nuban: string;
  amount: number;
  sessionId: string; // provider's unique reference for this specific credit — used for idempotency
  narration?: string;
  paidAt: string;
}

export interface DvaAdapter {
  provisionAccount(input: ProvisionVirtualAccountInput): Promise<ProvisionedVirtualAccount>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
}