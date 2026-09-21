import logger from '@shared/utils/logger';
import { ledgerService } from '@modules/ledger/services/ledger.service';

const AGENT_COMMISSION_RATE = 0.02; // 2% — adjust per PRD/business rules once finalized with BE1
const PLATFORM_MARKUP_RATE = 0.01; // 1%

export class CommissionService {
  /**
   * Splits a VAS purchase amount three ways: agent commission (if this was
   * an agent-initiated sale), platform markup, and the biller's net payable.
   * All three legs post as separate ledger entries so nothing is implicit.
   */
  async splitAndCredit(params: {
    reference: string;
    amount: number;
    agentId?: string;
  }): Promise<void> {
    const { reference, amount, agentId } = params;

    const platformMarkup = round2(amount * PLATFORM_MARKUP_RATE);
    let agentCommission = 0;

    if (agentId) {
      agentCommission = round2(amount * AGENT_COMMISSION_RATE);
      await ledgerService.postJournalEntry({
        reference: `${reference}-agent-commission`,
        userId: agentId,
        amount: agentCommission,
        type: 'credit',
        account: 'customer_balance', // agent's own sub-wallet, modeled as their customer_balance
        description: `Agent commission for ${reference}`,
      });
    }

    await ledgerService.postJournalEntry({
      reference: `${reference}-platform-markup`,
      userId: 'platform', // BE1's ledger implementation resolves this to the actual platform reserve account
      amount: platformMarkup,
      type: 'credit',
      account: 'fee_reserve',
      description: `Platform markup for ${reference}`,
    });

    const billerNetPayable = round2(amount - platformMarkup - agentCommission);

    await ledgerService.postJournalEntry({
      reference: `${reference}-biller-payable`,
      userId: 'platform',
      amount: billerNetPayable,
      type: 'debit',
      account: 'settlement_pool',
      description: `Net payable to biller for ${reference}`,
    });

    logger.info(
      `[commission] ${reference}: agent=${agentCommission} markup=${platformMarkup} biller=${billerNetPayable}`
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const commissionService = new CommissionService();