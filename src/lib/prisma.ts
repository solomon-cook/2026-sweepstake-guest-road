import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { getDatabaseUrl } from './database-url'

declare global {
  var prismaClientSingleton: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    throw new Error(
      'No database URL is configured. Set DATABASE_URL, PRISMA_DATABASE_URL, or POSTGRES_URL.',
    )
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl })

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
