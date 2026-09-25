// Re-exports BE1's shared Prisma singleton so BE2 modules importing from
// this path and BE1 modules importing from config/prisma both use the
// exact same PrismaClient instance — avoids two separate connection
// pools running against the same MySQL database simultaneously.
import { prisma } from './prisma';

export default prisma;