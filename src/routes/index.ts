import { Router } from 'express';
import transferRoutes from '@modules/transfer-switch/routes/transfer.routes';

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

// Future BE2 module routers get mounted here as they're built:
// rootRouter.use('/virtual-accounts', virtualAccountsRouter);
// rootRouter.use('/vas', vasRouter);
// rootRouter.use('/tms', tmsRouter);

export default rootRouter;