import fs from 'fs';
import path from 'path';
import prisma from '@config/database';
import logger from '@shared/utils/logger';
import { toCsv } from '../utils/csvFormatter';

const NFIU_EXPORT_DIR = process.env.NFIU_EXPORT_DIR ?? './exports/nfiu';
const CBN_EXPORT_DIR = process.env.CBN_EXPORT_DIR ?? './exports/cbn';

// CBN/NFIU-mandated threshold above which a single transaction requires
// a Currency Transaction Report — confirm the exact figure with BE1/
// compliance before going live, this mirrors the commonly cited ₦5,000,000 CTR trigger.
const CTR_THRESHOLD = 5_000_000;

export class ExporterService {
  /**
   * Generates a Suspicious Transaction Report export. In production this
   * would pull from a fraud-flagged transaction table (owned jointly with
   * BE1's fraud engine) — for now it pulls from VasTransactionLog and
   * TransferRoute activity as a placeholder data source so the export
   * pipeline itself is proven end-to-end.
   */
  async generateStrExport(date: Date = new Date()): Promise<string> {
    ensureDir(NFIU_EXPORT_DIR);

    const flagged = await prisma.vasTransactionLog.findMany({
      where: { status: 'failed' }, // placeholder criterion — real STR logic lives with fraud engine
      take: 500,
    });

    const rows = flagged.map((tx) => ({
      reference: tx.reference,
      userId: tx.userId,
      category: tx.category,
      amount: tx.amount.toString(),
      status: tx.status,
      date: tx.createdAt.toISOString(),
    }));

    const csv = toCsv(rows);
    const filename = `STR_${formatDate(date)}.csv`;
    const filepath = path.join(NFIU_EXPORT_DIR, filename);

    fs.writeFileSync(filepath, csv);
    logger.info(`[compliance] STR export written: ${filepath} (${rows.length} rows)`);

    return filepath;
  }

  /**
   * Currency Transaction Report — any single transaction above the
   * CBN/NFIU threshold, regardless of suspicion flags.
   */
  async generateCtrExport(date: Date = new Date()): Promise<string> {
    ensureDir(CBN_EXPORT_DIR);

    const largeTx = await prisma.vasTransactionLog.findMany({
      where: { amount: { gte: CTR_THRESHOLD } },
      take: 500,
    });

    const rows = largeTx.map((tx) => ({
      reference: tx.reference,
      userId: tx.userId,
      amount: tx.amount.toString(),
      date: tx.createdAt.toISOString(),
    }));

    const csv = toCsv(rows);
    const filename = `CTR_${formatDate(date)}.csv`;
    const filepath = path.join(CBN_EXPORT_DIR, filename);

    fs.writeFileSync(filepath, csv);
    logger.info(`[compliance] CTR export written: ${filepath} (${rows.length} rows)`);

    return filepath;
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export const exporterService = new ExporterService();