import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';
import { authenticateToken } from '../../../shared/middlewares/auth.middleware';

const router = Router();

// All account routes require a valid JWT token
router.use(authenticateToken);

router.post('/', AccountController.createAccount);
router.get('/', AccountController.getMyAccounts);
router.get('/:id/balance', AccountController.getBalance);

export default router;