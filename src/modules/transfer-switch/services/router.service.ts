import prisma from '@config/database';
import logger from '@shared/utils/logger';
import { TransferRouteName } from '../types/transfer.types';

const WINDOW_MINUTES = Number(process.env.TRANSFER_ROUTE_WINDOW_MINUTES ?? 5);
const MIN_SUCCESS_RATE = 0.85; // below this, a route is considered degraded

export class RouterService {
  /**
   * Picks the best available route based on rolling success rate.
   * Falls back to 'nibss' if no routing data exists yet (cold start).
   */
  async selectRoute(): Promise<TransferRouteName> {
    const routes = await prisma.transferRoute.findMany({
      where: { isActive: true },
    });

    if (routes.length === 0) {
      logger.warn('[router] no route data yet — defaulting to nibss');
      return 'nibss';
    }

    const scored = routes.map((r) => {
      const total = r.successCount + r.failureCount;
      const successRate = total === 0 ? 1 : r.successCount / total;
      return { name: r.routeName as TransferRouteName, successRate, total };
    });

    // Prefer the healthiest route; among healthy routes, prefer the one with more volume (more trustworthy signal)
    const healthy = scored.filter((r) => r.successRate >= MIN_SUCCESS_RATE);
    const candidates = healthy.length > 0 ? healthy : scored;

    candidates.sort((a, b) => b.successRate - a.successRate || b.total - a.total);

    const chosen = candidates[0].name;
    logger.debug(`[router] selected route: ${chosen} (rate: ${candidates[0].successRate.toFixed(2)})`);
    return chosen;
  }

  /**
   * Records the outcome of a transfer attempt against its route, resetting
   * the counters if the current window has expired.
   */
  async recordOutcome(routeName: TransferRouteName, success: boolean): Promise<void> {
    const existing = await prisma.transferRoute.findFirst({ where: { routeName } });
    const windowExpired =
      existing &&
      Date.now() - existing.windowStartedAt.getTime() > WINDOW_MINUTES * 60 * 1000;

    if (!existing) {
      await prisma.transferRoute.create({
        data: {
          routeName,
          successCount: success ? 1 : 0,
          failureCount: success ? 0 : 1,
        },
      });
      return;
    }

    if (windowExpired) {
      // Roll the window: reset counters, start fresh
      await prisma.transferRoute.update({
        where: { id: existing.id },
        data: {
          successCount: success ? 1 : 0,
          failureCount: success ? 0 : 1,
          windowStartedAt: new Date(),
        },
      });
      return;
    }

    await prisma.transferRoute.update({
      where: { id: existing.id },
      data: {
        successCount: { increment: success ? 1 : 0 },
        failureCount: { increment: success ? 0 : 1 },
      },
    });
  }
}

export const routerService = new RouterService();