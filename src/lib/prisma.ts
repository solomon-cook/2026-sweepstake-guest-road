import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { getDatabaseUrl } from './database-url'

declare global {
  var prismaClientSingleton: PrismaClient | undefined
}

function getPoolMax() {
  const poolMax = Number(process.env.DATABASE_POOL_MAX)

  if (Number.isInteger(poolMax) && poolMax > 0) {
    return poolMax
  }

  return 1
}

function createPrismaClient() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    throw new Error(
      'No database URL is configured. Set DATABASE_URL, PRISMA_DATABASE_URL, or POSTGRES_URL.',
    )
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: getPoolMax(),
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  })

  return new PrismaClient({
    adapter,
  })
}

export function getPrismaClient() {
  if (!globalThis.prismaClientSingleton) {
    globalThis.prismaClientSingleton = createPrismaClient()
  }

  return globalThis.prismaClientSingleton
}
