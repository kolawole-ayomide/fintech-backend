import Redis from 'ioredis';

// Shared Redis connection used for: idempotency locks (transfer-switch,
// virtual-accounts webhooks), BullMQ queues (reversal-engine, compliance
// jobs), and rolling success-rate counters (transfer-switch router).
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
});

redis.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[redis] connection error:', err.message);
});

export default redis;