import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'
import { getMigrationDatabaseUrl } from './src/lib/database-url'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env.preview' })
loadEnv()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: getMigrationDatabaseUrl() || 'postgresql://postgres:postgres@127.0.0.1:5432/sweepstake',
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
