import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'
import { getDatabaseUrl } from '../src/lib/database-url'
import { TEAM_SEED_SCORES } from '../src/lib/team-source'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env.preview' })
loadEnv()

const databaseUrl = getDatabaseUrl()

if (!databaseUrl) {
  throw new Error(
    'No database URL is configured for seeding. Set DATABASE_URL, PRISMA_DATABASE_URL, or POSTGRES_URL.',
  )
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  for (const team of TEAM_SEED_SCORES) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {
        flag: team.flag,
        group: team.group,
        odds: team.odds,
        impliedProbability: team.impliedProbability,
        score: team.score,
        rank: team.rank,
      },
      create: {
        name: team.name,
        flag: team.flag,
        group: team.group,
        odds: team.odds,
        impliedProbability: team.impliedProbability,
        score: team.score,
        rank: team.rank,
      },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
