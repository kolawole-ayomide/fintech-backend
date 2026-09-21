import dotenv from 'dotenv';

dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: required('NODE_ENV', 'development'),
  port: Number(required('PORT', '4000')),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_secret'),
  },

  transferSwitch: {
    routeWindowMinutes: Number(process.env.TRANSFER_ROUTE_WINDOW_MINUTES ?? 5),
    autoReversalTimeoutMinutes: Number(process.env.AUTO_REVERSAL_TIMEOUT_MINUTES ?? 10),
  },

  vas: {
    aggregatorTimeoutMs: Number(process.env.VAS_AGGREGATOR_TIMEOUT_MS ?? 1500),
  },
};