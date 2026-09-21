import { Router } from 'express';
import { transferController } from '../controllers/transfer.controller';

const router = Router();

router.post('/', (req, res, next) => transferController.initiate(req, res, next));
router.get('/name-enquiry', (req, res, next) => transferController.nameEnquiry(req, res, next));

export default router;