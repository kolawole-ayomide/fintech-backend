import logger from '@shared/utils/logger';
import { VasAdapter, VasPurchaseInput, VasPurchaseResult } from '../types/vas.types';
import { BaxiAdapter } from '../adapters/baxi.adapter';
import { CoralpayAdapter } from '../adapters/coralpay.adapter';
import { InterswitchAdapter } from '../adapters/interswitch.adapter';

const TIMEOUT_MS = Number(process.env.VAS_AGGREGATOR_TIMEOUT_MS ?? 1500);

// Ordered by preference — tried in sequence, each with its own timeout window.
const adapterChain: VasAdapter[] = [new BaxiAdapter(), new CoralpayAdapter(), new InterswitchAdapter()];

export class FailoverService {
  /**
   * Attempts the purchase against each adapter in order. If an adapter
   * doesn't respond within TIMEOUT_MS, or throws, moves to the next one
   * immediately — this is the <1.5s failover switch from the PRD.
   */
  async purchaseWithFailover(input: VasPurchaseInput): Promise<VasPurchaseResult> {
    for (const adapter of adapterChain) {
      try {
        const result = await withTimeout(adapter.purchase(input), TIMEOUT_MS, adapter.provider);
        // A definitive success or a definitive business-logic failure (biller
        // rejection) both count as "this adapter answered" — no need to try
        // the next one. Only a timeout/exception triggers failover.
        return result;
      } catch (err) {
        logger.warn(`[vas-failover] ${adapter.provider} failed or timed out — trying next aggregator`);
        continue;
      }
    }

    throw new Error('All VAS aggregators failed or timed out');
  }

  async lookupWithFailover(fn: (adapter: VasAdapter) => Promise<any>) {
    for (const adapter of adapterChain) {
      try {
        return await withTimeout(fn(adapter), TIMEOUT_MS, adapter.provider);
      } catch {
        continue;
      }
    }
    throw new Error('All VAS aggregators failed or timed out during lookup');
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, providerLabel: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${providerLabel} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const failoverService = new FailoverService();