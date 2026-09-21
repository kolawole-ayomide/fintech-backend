import { PrismaClient } from '@prisma/client';

// Single shared Prisma client instance. MySQL connection pooling is handled
// by the underlying driver; do not instantiate PrismaClient anywhere else.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export default prisma;