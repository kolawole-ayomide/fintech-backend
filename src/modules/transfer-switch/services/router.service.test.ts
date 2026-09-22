import { RouterService } from './router.service';

jest.mock('@config/database', () => ({
  __esModule: true,
  default: {
    transferRoute: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from '@config/database';

describe('RouterService.selectRoute', () => {
  const routerService = new RouterService();

  it('defaults to nibss when no route data exists yet', async () => {
    (prisma.transferRoute.findMany as jest.Mock).mockResolvedValue([]);

    const route = await routerService.selectRoute();

    expect(route).toBe('nibss');
  });

  it('prefers the route with the highest success rate', async () => {
    (prisma.transferRoute.findMany as jest.Mock).mockResolvedValue([
      { routeName: 'nibss', successCount: 50, failureCount: 50, isActive: true },
      { routeName: 'direct_bank', successCount: 95, failureCount: 5, isActive: true },
    ]);

    const route = await routerService.selectRoute();

    expect(route).toBe('direct_bank');
  });

  it('falls back to the best available route when all are below the healthy threshold', async () => {
    (prisma.transferRoute.findMany as jest.Mock).mockResolvedValue([
      { routeName: 'nibss', successCount: 40, failureCount: 60, isActive: true },
      { routeName: 'direct_bank', successCount: 30, failureCount: 70, isActive: true },
    ]);

    const route = await routerService.selectRoute();

    // Neither meets the 0.85 healthy threshold, so it should still pick the better of the two
    expect(route).toBe('nibss');
  });
});

describe('RouterService.recordOutcome', () => {
  const routerService = new RouterService();

  it('creates a new route record on first outcome', async () => {
    (prisma.transferRoute.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.transferRoute.create as jest.Mock).mockResolvedValue({});

    await routerService.recordOutcome('nibss', true);

    expect(prisma.transferRoute.create).toHaveBeenCalledWith({
      data: { routeName: 'nibss', successCount: 1, failureCount: 0 },
    });
  });

  it('increments existing counters within the same window', async () => {
    const windowStartedAt = new Date(); // just started, well within window
    (prisma.transferRoute.findFirst as jest.Mock).mockResolvedValue({
      id: 'route-1',
      windowStartedAt,
    });
    (prisma.transferRoute.update as jest.Mock).mockResolvedValue({});

    await routerService.recordOutcome('nibss', false);

    expect(prisma.transferRoute.update).toHaveBeenCalledWith({
      where: { id: 'route-1' },
      data: { successCount: { increment: 0 }, failureCount: { increment: 1 } },
    });
  });
});