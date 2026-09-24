import { Router } from 'express';
import { CreditController } from '../controllers/credit.controller';
import { authGuard } from '../../../shared/middlewares/authGuard';

const router = Router();

router.post('/apply', authGuard, CreditController.requestCredit);
router.post('/gsi-mandate', authGuard, CreditController.setupGsi);

export default router;