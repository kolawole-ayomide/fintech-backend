import { Router } from 'express';
import { KycController } from '../controllers/kyc.controller';
// import { authGuard } from '../../../shared/middleware/authGuard'; // Update to your actual auth guard path

const router = Router();

// Apply authGuard middleware to ensure only authenticated users can submit KYC
// router.use(authGuard);

router.post('/verify-tier2', KycController.verifyTier2);
router.post('/verify-tier3', KycController.verifyTier3);

export default router;