import { Router } from 'express';
import { vasController } from '../controllers/vas.controller';

const router = Router();

router.get('/lookup', (req, res, next) => vasController.lookup(req, res, next));
router.post('/purchase', (req, res, next) => vasController.purchase(req, res, next));

export default router;