import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from '@shared/middlewares/errorHandler';
import rootRouter from './routes';
import authRoutes from './modules/auth/routes/auth.routes';
import kycRoutes from './modules/kyc/routes/kyc.routes';
import creditRoutes from './modules/credit/routes/credit.routes';
import ledgerRoutes from './modules/ledger/routes/ledger.routes';
import accountRouter from './modules/accounts/routes/account.routes';
import transactionRoutes from './modules/transactions/routes/transaction.routes';
import statementRoutes from './modules/statement/routes/statement.routes'; // <-- Clean dedicated path
import adminRoutes from './modules/admin/routes/admin.routes';
import { StatementScheduler } from './modules/statement/jobs/statement.scheduler';


export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api/v1', rootRouter);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/kyc', kycRoutes);
  app.use('/api/v1/credit', creditRoutes);
  app.use('/api/v1/ledger', ledgerRoutes);
  app.use('/api/v1/accounts', accountRouter);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/statements', statementRoutes); // <-- Mounted cleanly under /api/v1/statements
  app.use('/api/v1/admin', adminRoutes);

  // Keep this last.
  app.use(errorHandler);

  // Initialize background cron jobs for automated monthly statements
  StatementScheduler.initCronJobs();

  return app;
}