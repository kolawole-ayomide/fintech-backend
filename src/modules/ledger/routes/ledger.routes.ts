import { Router } from 'express';
import { LedgerController } from '../controllers/ledger.controller';
import { authenticateToken } from '../../../shared/middlewares/auth.middleware';
import { idempotencyMiddleware } from '../../../shared/middlewares/idempotency.middleware';

const router = Router();

// Protect all ledger routes with JWT verification
router.use(authenticateToken);

// Execute a balanced double-entry transaction (using your postTransaction method)
router.post('/',idempotencyMiddleware, LedgerController.postTransaction);

// Fetch transaction audit trail for the authenticated user's accounts
router.get('/transactions', LedgerController.getTransactionHistory);

export default router;