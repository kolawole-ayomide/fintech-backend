import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/middlewares/auth.middleware';
import { LedgerService } from '../services/ledger.service';

export class LedgerController {
  static async postTransaction(req: Request, res: Response) {
    try {
      const { reference, narration, postings } = req.body;

      if (!reference || !narration || !postings || !Array.isArray(postings)) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields: reference, narration, or postings array',
        });
      }

      const transaction = await LedgerService.executeTransaction({
        reference,
        narration,
        postings,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Ledger transaction executed successfully',
        data: transaction,
      });
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }

  static async getBalance(req: Request, res: Response) {
    try {
      const { accountId } = req.params;
      const account = await LedgerService.getAccountBalance(accountId);

      return res.status(200).json({
        status: 'success',
        data: account,
      });
    } catch (error) {
      return res.status(404).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Account not found',
      });
    }
  }

  // Added for Phase 2: Transaction Audit History
  static async getTransactionHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }

      const transactions = await LedgerService.getUserTransactions(userId);

      return res.status(200).json({
        status: 'success',
        results: transactions.length,
        data: transactions,
      });
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
}