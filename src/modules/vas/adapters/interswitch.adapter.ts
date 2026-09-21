import { v4 as uuid } from 'uuid';
import logger from '@shared/utils/logger';
import { PreDebitLookupInput, PreDebitLookupResult, VasAdapter, VasPurchaseInput, VasPurchaseResult } from '../types/vas.types';

export class InterswitchAdapter implements VasAdapter {
  provider = 'interswitch' as const;

  async preDebitLookup(input: PreDebitLookupInput): Promise<PreDebitLookupResult> {
    await delay(randomLatency());
    return { identifier: input.identifier, holderName: 'MOCK INTERSWITCH HOLDER', category: input.category };
  }

  async purchase(input: VasPurchaseInput): Promise<VasPurchaseResult> {
    await delay(randomLatency());

    if (Math.random() < 0.15) {
      await delay(2000);
    }

    const success = Math.random() > 0.1;
    logger.debug(`[interswitch] purchase ${input.reference}: ${success ? 'success' : 'failed'}`);

    return {
      reference: input.reference,
      provider: this.provider,
      status: success ? 'success' : 'failed',
      providerReference: `ISW-${uuid()}`,
      failureReason: success ? undefined : 'Mock biller rejection',
    };
  }
}

function randomLatency(): number {
  return 200 + Math.random() * 400;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}