import logger from '@shared/utils/logger';
import { exporterService } from './exporter.service';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function startComplianceScheduler(): void {
  // Run once shortly after boot (useful for dev/testing), then daily.
  setTimeout(runExports, 10_000);
  setInterval(runExports, TWENTY_FOUR_HOURS_MS);

  logger.info('[compliance] scheduler started — daily STR/CTR export job registered');
}

async function runExports(): Promise<void> {
  try {
    await exporterService.generateStrExport();
    await exporterService.generateCtrExport();
  } catch (err) {
    logger.error(`[compliance] scheduled export failed: ${(err as Error).message}`);
  }
}