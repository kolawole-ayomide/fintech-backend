import { Router } from 'express';
import { TransactionController } from '../../transactions/controllers/transaction.controller';
import { StatementController } from '../controllers/statement.controller'; // Point to where your controller lives
import { authGuard } from '../../../shared/middlewares/authGuard';
import { transferLimiter } from '../../../shared/middlewares/rateLimiter';

const router = Router();

// Existing transaction routes...
router.post('/transfer', authGuard, transferLimiter, TransactionController.processTransfer);

// Statement / Audit trail routes housed in transactions
router.get('/history', authGuard, StatementController.getHistory);
router.get('/monthly-statement', authGuard, StatementController.getMonthlyStatement);

export default router;