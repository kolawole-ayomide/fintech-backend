import { CommissionService } from './commission.service';

jest.mock('@modules/ledger/services/ledger.service', () => ({
  ledgerService: {
    postJournalEntry: jest.fn(),
  },
}));

import { ledgerService } from '@modules/ledger/services/ledger.service';

describe('CommissionService.splitAndCredit', () => {
  const commissionService = new CommissionService();

  it('splits correctly with no agent (no commission leg)', async () => {
    await commissionService.splitAndCredit({ reference: 'ref-1', amount: 1000 });

    // Only two legs posted: platform markup + biller payable, no agent commission
    expect(ledgerService.postJournalEntry).toHaveBeenCalledTimes(2);

    expect(ledgerService.postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10, account: 'fee_reserve', type: 'credit' }) // 1% of 1000
    );
    expect(ledgerService.postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 990, account: 'settlement_pool', type: 'debit' }) // remainder
    );
  });

  it('splits correctly with an agent (three legs)', async () => {
    await commissionService.splitAndCredit({ reference: 'ref-2', amount: 1000, agentId: 'agent-1' });

    expect(ledgerService.postJournalEntry).toHaveBeenCalledTimes(3);

    expect(ledgerService.postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20, userId: 'agent-1', type: 'credit' }) // 2% agent commission
    );
    expect(ledgerService.postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10, account: 'fee_reserve' }) // 1% platform markup
    );
    expect(ledgerService.postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 970, account: 'settlement_pool' }) // 1000 - 20 - 10
    );
  });
});