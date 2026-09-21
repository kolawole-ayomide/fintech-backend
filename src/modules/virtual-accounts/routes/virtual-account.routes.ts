import { Router } from 'express';
import { virtualAccountController } from '../controllers/virtual-account.controller';

const router = Router();

router.post('/', (req, res, next) => virtualAccountController.provision(req, res, next));
router.get('/user/:userId', (req, res, next) => virtualAccountController.getForUser(req, res, next));
router.post('/webhook/deposit', (req, res, next) => virtualAccountController.handleDepositWebhook(req, res, next));

export default router;