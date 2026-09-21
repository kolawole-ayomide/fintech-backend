import prisma from '@config/database';
import logger from '@shared/utils/logger';
import { ledgerService } from '@modules/ledger/services/ledger.service';
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

  /**
   * Processes a card transaction initiated at the terminal. In a real
   * ISO 8583 integration, this would be triggered by parsing an 0200
   * (financial transaction request) message and responding with 0210.
   */
  async processTransaction(input: TerminalTransactionInput): Promise<TerminalTransactionResult> {
    const terminal = await prisma.terminalSession.findFirst({
      where: { terminalId: input.terminalId },
    });

    if (!terminal || !terminal.isOnline) {
      logger.warn(`[tms] transaction rejected — terminal ${input.terminalId} not online`);
      return { reference: input.reference, status: 'failed' };
    }

    // Simulate the three real-world outcomes a POS transaction can have:
    // clean success, biller/network failure, or a dispense error (card
    // charged but the terminal failed to complete — needs reversal).
    const roll = Math.random();
    let status: TerminalTransactionResult['status'];

    if (roll < 0.85) status = 'success';
    else if (roll < 0.95) status = 'failed';
    else status = 'dispense_error';

    logger.info(`[tms] transaction ${input.reference} on ${input.terminalId}: ${status}`);

    if (status === 'success') {
      await ledgerService.postJournalEntry({
        reference: input.reference,
        userId: input.agentId,
        amount: input.amount,
        type: 'credit',
        account: 'customer_balance', // agent's commission sub-wallet
        description: `POS transaction via ${input.terminalId}`,
      });
    }

    if (status === 'dispense_error') {
      // Card was charged upstream but the terminal didn't complete the
      // dispense — this needs the same reversal-engine treatment as a
      // stuck bank transfer. For now we log it distinctly so compliance/
      // ops can see it; wiring it into reversal-engine's queue is a
      // natural next step once BE1's card-acquiring flow is finalized.
      logger.error(`[tms] DISPENSE ERROR on ${input.terminalId} — reference ${input.reference} needs manual/auto reversal`);
    }

    return { reference: input.reference, status, providerReference: `TMS-${input.terminalId}-${Date.now()}` };
  }

  async listOnlineTerminals() {
    return prisma.terminalSession.findMany({ where: { isOnline: true } });
  }
}

export const tmsService = new TmsService();