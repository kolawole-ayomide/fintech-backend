import prisma from '@config/database';
import logger from '@shared/utils/logger';
import { ledgerService } from '@modules/ledger/services/ledger.service';
import { scheduleReversalCheck } from '@modules/reversal-engine/queues/reversal.queue';
import { TerminalHeartbeatInput, TerminalTransactionInput, TerminalTransactionResult } from '../types/tms.types';

export class TmsService {
  async recordHeartbeat(input: TerminalHeartbeatInput) {
    const existing = await prisma.terminalSession.findFirst({
      where: { terminalId: input.terminalId },
    });

    if (existing) {
      return prisma.terminalSession.update({
        where: { id: existing.id },
        data: { lastHeartbeat: new Date(), isOnline: true, model: input.model },
      });
    }

    logger.info(`[tms] new terminal registered: ${input.terminalId} (${input.model})`);
    return prisma.terminalSession.create({
      data: { terminalId: input.terminalId, model: input.model, isOnline: true },
    });
  }

  async processTransaction(input: TerminalTransactionInput): Promise<TerminalTransactionResult> {
    const terminal = await prisma.terminalSession.findFirst({
      where: { terminalId: input.terminalId },
    });

    if (!terminal || !terminal.isOnline) {
      logger.warn(`[tms] transaction rejected — terminal ${input.terminalId} not online`);
      return { reference: input.reference, status: 'failed' };
    }

    const roll = Math.random();
    let status: TerminalTransactionResult['status'];

    if (roll < 0.85) status = 'success';
    else if (roll < 0.95) status = 'failed';
    else status = 'dispense_error';

    logger.info(`[tms] transaction ${input.reference} on ${input.terminalId}: ${status}`);

    const providerReference = `TMS-${input.terminalId}-${Date.now()}`;

    if (status === 'success') {
      await ledgerService.postJournalEntry({
        reference: input.reference,
        userId: input.agentId,
        amount: input.amount,
        type: 'credit',
        account: 'customer_balance',
        description: `POS transaction via ${input.terminalId}`,
      });
    }

    if (status === 'dispense_error') {
      // Card was charged upstream but the terminal failed to complete the
      // dispense. Treat this exactly like a stuck bank transfer: debit the
      // customer now (mirrors what actually happened at the card network
      // level), then hand it to reversal-engine to poll and auto-reverse
      // within the same timeout window as everything else.
      logger.error(`[tms] DISPENSE ERROR on ${input.terminalId} — reference ${input.reference}, scheduling auto-reversal`);

      await ledgerService.postJournalEntry({
        reference: input.reference,
        userId: input.agentId,
        amount: input.amount,
        type: 'debit',
        account: 'customer_balance',
        description: `POS dispense error hold — ${input.terminalId}`,
      });

      await scheduleReversalCheck({
        reference: input.reference,
        providerReference,
        route: 'nibss', // TMS transactions route through the same reversal check; adjust if BE1/PRD define a distinct TMS route type
        userId: input.agentId,
        amount: input.amount,
      });
    }

    return { reference: input.reference, status, providerReference };
  }

  async listOnlineTerminals() {
    return prisma.terminalSession.findMany({ where: { isOnline: true } });
  }
}

export const tmsService = new TmsService();