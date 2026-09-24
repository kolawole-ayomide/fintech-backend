import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authGuard } from '../../../shared/middlewares/authGuard';
import { adminGuard } from '../../../shared/middlewares/adminGuard';

const router = Router();

// Apply authGuard and adminGuard globally to all routes in this router
router.use(authGuard, adminGuard);

// User oversight & management
router.get('/users', AdminController.getUsers);

// Freeze or unfreeze compromised customer accounts
router.patch('/users/:userId/status', AdminController.updateAccountStatus);

// Manual compliance KYC override
router.patch('/users/:userId/kyc-override', AdminController.overrideKyc);

// System-wide ledger float and liquidity inspection
router.get('/ledger/overview', AdminController.getSystemLedger);

export default router;