import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const cliDatabaseUrl =
  process.env.DIRECT_URL
  || process.env.DATABASE_URL
  || 'postgresql://prisma_config_only:unused@127.0.0.1:5432/postgres';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: cliDatabaseUrl,
  },
});
