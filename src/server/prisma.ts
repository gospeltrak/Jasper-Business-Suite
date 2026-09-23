import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type PrismaGlobal = typeof globalThis & {
  __orvixPrisma?: PrismaClient;
};

const prismaGlobal = globalThis as PrismaGlobal;

export const isPrismaConfigured = () => Boolean(process.env.DATABASE_URL?.trim());

const readDatabaseUrl = (value: string, label: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL connection URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use the postgres:// or postgresql:// protocol.`);
  }
  return parsed;
};

export function assertSafePrismaConnectionUrls(connectionString: string): void {
  const runtimeUrl = readDatabaseUrl(connectionString, 'DATABASE_URL');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (runtimeUrl.port !== '6543') {
      throw new Error('DATABASE_URL must use the Supabase transaction pooler on port 6543 in production.');
    }
    if (runtimeUrl.searchParams.get('pgbouncer') !== 'true') {
      throw new Error('DATABASE_URL must include pgbouncer=true for the Supabase transaction pooler.');
    }
  }

  const directConnectionString = process.env.DIRECT_URL?.trim();
  if (!directConnectionString) return;
  const directUrl = readDatabaseUrl(directConnectionString, 'DIRECT_URL');
  if (directUrl.port && directUrl.port !== '5432') {
    throw new Error('DIRECT_URL must use port 5432 for Prisma CLI and migration workflows.');
  }
  if (directUrl.toString() === runtimeUrl.toString()) {
    throw new Error('DIRECT_URL must not reuse the pooled DATABASE_URL.');
  }
}

export function getPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('Prisma database access is not configured.');
  }
  if (prismaGlobal.__orvixPrisma) return prismaGlobal.__orvixPrisma;

  assertSafePrismaConnectionUrls(connectionString);

  const adapter = new PrismaPg({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    maxLifetimeSeconds: 300,
  });
  const client = new PrismaClient({ adapter });
  prismaGlobal.__orvixPrisma = client;
  return client;
}
