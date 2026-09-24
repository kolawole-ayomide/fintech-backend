import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { StatementService } from '../services/statement.service';

const prisma = new PrismaClient();

export class StatementScheduler {
  public static initCronJobs() {
    // Schedule: Runs at 00:00 on the 1st day of every month
    cron.schedule('0 0 1 * *', async () => {
      console.log('[Cron Job] Starting automated monthly statement generation...');

      try {
        const now = new Date();
        let targetMonth = now.getMonth(); 
        let targetYear = now.getFullYear();

        if (targetMonth === 0) {
          targetMonth = 12;
          targetYear -= 1;
        }

        const usersWithWallets = await prisma.account.findMany({
          where: { accountType: 'CUSTOMER_WALLET' },
          select: { userId: true },
          distinct: ['userId'],
        });

        console.log(`[Cron Job] Generating statements for ${usersWithWallets.length} users for ${targetMonth}/${targetYear}...`);

        for (const record of usersWithWallets) {
          if (!record.userId) continue;

          try {
            await StatementService.generateMonthlyStatement(record.userId, targetMonth, targetYear);
          } catch (error) {
            console.error(`[Cron Job] Failed to generate statement for user ${record.userId}:`, error);
          }
        }

        console.log('[Cron Job] Monthly statement generation completed successfully.');
      } catch (error) {
        console.error('[Cron Job Error] Failed to execute monthly statement batch:', error);
      }
    });

    console.log('🗓️  Statement scheduler cron job initialized successfully.');
  }
}