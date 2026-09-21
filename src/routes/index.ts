import { Router } from 'express';
import transferRoutes from '@modules/transfer-switch/routes/transfer.routes';
import virtualAccountRoutes from '@modules/virtual-accounts/routes/virtual-account.routes';
import vasRoutes from '@modules/vas/routes/vas.routes';
import tmsRoutes from '@modules/tms/routes/tms.routes';

const rootRouter = Router();

rootRouter.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'fintech-backend',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

rootRouter.use('/transfers', transferRoutes);
rootRouter.use('/virtual-accounts', virtualAccountRoutes);
rootRouter.use('/vas', vasRoutes);
rootRouter.use('/tms', tmsRoutes);

export default rootRouter;