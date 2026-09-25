import logger from '@shared/utils/logger';
import { ledgerService } from '@modules/ledger/services/ledger.service';
import { routerService } from '@modules/transfer-switch/services/router.service';
import { NibssAdapter } from '@modules/transfer-switch/adapters/nibss.adapter';
import { TransferAdapter, TransferRouteName } from '@modules/transfer-switch/types/transfer.types';

const adapters: Record<string, TransferAdapter> = {
  nibss: new NibssAdapter(),
};

const AUTO_REVERSAL_TIMEOUT_MINUTES = Number(process.env.AUTO_REVERSAL_TIMEOUT_MINUTES ?? 10);

export class ReversalService {
  /**
   * Checks upstream status for a transfer. If it's settled, does nothing.
   * If it's failed, reverses immediately. If still processing and within
   * the timeout window, signals the caller to re-check later. If it's
   * past the timeout window and still not settled, force-reverses it —
   * this is the sub-10-minute guarantee from the PRD.
   */
  async checkAndReverseIfNeeded(params: {
    reference: string;
    providerReference: string;
    route: TransferRouteName;
    userId: string;
    amount: number;
    initiatedAt: Date;
  }): Promise<{ action: 'none' | 'reversed' | 'retry' }> {
    const adapter = adapters[params.route];
    if (!adapter) {
      logger.error(`[reversal] no adapter for route ${params.route}`);
      return { action: 'none' };
    }

    const status = await adapter.checkStatus(params.providerReference);
    const minutesElapsed = (Date.now() - params.initiatedAt.getTime()) / 60_000;

    if (status === 'settled') {
      logger.info(`[reversal] ${params.reference} settled — no action needed`);
      return { action: 'none' };
    }

    if (status === 'failed') {
      await this.reverse(params, 'Upstream transfer failed');
      return { action: 'reversed' };
    }

    // Still "processing" — check if we've blown past the timeout window
    if (minutesElapsed >= AUTO_REVERSAL_TIMEOUT_MINUTES) {
      await this.reverse(params, `Timed out after ${AUTO_REVERSAL_TIMEOUT_MINUTES} minutes`);
      return { action: 'reversed' };
    }

    logger.debug(`[reversal] ${params.reference} still processing (${minutesElapsed.toFixed(1)} min elapsed) — will recheck`);
    return { action: 'retry' };
  }

  private async reverse(
    params: { reference: string; route: TransferRouteName; userId: string; amount: number },
    reason: string
  ): Promise<void> {
    logger.warn(`[reversal] reversing ${params.reference}: ${reason}`);

    // reverseTransaction now performs a real, balanced reversal of every
    // posting on the original transaction (including crediting the
    // customer back) — the extra manual credit here was a leftover from
    // when this was a no-op mock, and would double-credit the customer
    // against a real ledger. Removed.
    await ledgerService.reverseTransaction({
      originalReference: params.reference,
      reason,
    });

    await routerService.recordOutcome(params.route, false);
  }
}

export const reversalService = new ReversalService();