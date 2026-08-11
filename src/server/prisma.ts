import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type PrismaGlobal = typeof globalThis & {
  __orvixPrisma?: PrismaClient;
};

const prismaGlobal = globalThis as PrismaGlobal;

export const isPrismaConfigured = () => Boolean(process.env.DATABASE_URL?.trim());

export function getPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('Prisma database access is not configured.');
  }
  if (prismaGlobal.__orvixPrisma) return prismaGlobal.__orvixPrisma;

  const adapter = new PrismaPg({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
  const client = new PrismaClient({ adapter });
  prismaGlobal.__orvixPrisma = client;
  return client;
}
