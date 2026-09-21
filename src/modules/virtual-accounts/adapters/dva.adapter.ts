import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import logger from '@shared/utils/logger';
import { DvaAdapter, DvaProvider, ProvisionVirtualAccountInput, ProvisionedVirtualAccount } from '../types/virtual-account.types';

const BANK_NAMES: Record<DvaProvider, string> = {
  wema: 'Wema Bank',
  providus: 'Providus Bank',
  sterling: 'Sterling Bank',
};

const WEBHOOK_SECRET = process.env.DVA_WEBHOOK_SECRET ?? 'changeme_webhook_secret';

export class MockDvaAdapter implements DvaAdapter {
  async provisionAccount(input: ProvisionVirtualAccountInput): Promise<ProvisionedVirtualAccount> {
    const provider = input.provider ?? 'wema';
    logger.info(`[dva:${provider}] provisioning NUBAN for user ${input.userId}`);

    await delay(400);

    // Mock 10-digit NUBAN — real integration replaces this with the partner's response
    const nuban = generateMockNuban();

    return { nuban, bankName: BANK_NAMES[provider], provider };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;

    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

    // Timing-safe comparison to avoid leaking signature info via response-time side channel
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false; // length mismatch etc.
    }
  }
}

function generateMockNuban(): string {
  // 10 digits, doesn't start with 0 (mirrors real NUBAN convention)
  const first = Math.floor(Math.random() * 9) + 1;
  const rest = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return `${first}${rest}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const dvaAdapter: DvaAdapter = new MockDvaAdapter();
export { uuid };