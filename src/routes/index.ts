import { Router } from 'express';

const rootRouter = Router();

rootRouter.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'fintech-backend',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// BE2 module routers will be mounted here as they're built, e.g.:
// rootRouter.use('/transfers', transferSwitchRouter);
// rootRouter.use('/virtual-accounts', virtualAccountsRouter);
// rootRouter.use('/vas', vasRouter);
// rootRouter.use('/tms', tmsRouter);

export default rootRouter;