import { Router } from 'express';
import { tmsController } from '../controllers/tms.controller';

const router = Router();

router.post('/heartbeat', (req, res, next) => tmsController.heartbeat(req, res, next));
router.post('/transaction', (req, res, next) => tmsController.transaction(req, res, next));
router.get('/online', (req, res, next) => tmsController.listOnline(req, res, next));

export default router;