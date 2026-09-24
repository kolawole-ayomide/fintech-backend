export type VasCategory = 'airtime' | 'data' | 'electricity' | 'cable' | 'betting' | 'remita';
export type VasProvider = 'baxi' | 'coralpay' | 'interswitch';
export type VasPurchaseStatus = 'success' | 'failed';

export interface PreDebitLookupInput {
  category: VasCategory;
  identifier: string; // meter number, smartcard/IUC, betting user ID, etc.
  extra?: Record<string, string>; // e.g. { disco: 'ikeja-electric' }
}

export interface PreDebitLookupResult {
  identifier: string;
  holderName: string;
  category: VasCategory;
}

export interface VasPurchaseInput {
  userId: string;
  category: VasCategory;
  identifier: string;
  amount: number;
  agentId?: string; // present when purchase is made by an agent (commission applies)
  reference: string; // idempotency key
}

export interface VasPurchaseResult {
  reference: string;
  provider: VasProvider;
  status: VasPurchaseStatus;
  providerReference?: string;
  failureReason?: string;
}

export interface VasAdapter {
  provider: VasProvider;
  preDebitLookup(input: PreDebitLookupInput): Promise<PreDebitLookupResult>;
  purchase(input: VasPurchaseInput): Promise<VasPurchaseResult>;
}