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

async function fetchFlagImageBytes(flagCode: string) {
  const response = await fetch(`https://flagcdn.com/w20/${flagCode}.jpg`)

  if (!response.ok) {
    throw new Error(`Failed to download flag image for ${flagCode}: ${response.status}`)
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer())

  if (!imageBuffer.length) {
    throw new Error(`Downloaded empty flag image for ${flagCode}.`)
  }

  return imageBuffer
}

async function main() {
  for (const team of TEAM_SEED_SCORES) {
    const flagImageBytes = await fetchFlagImageBytes(team.flagCode)
    const existingTeam = await prisma.team.findUnique({
      where: { name: team.name },
      select: { id: true },
    })

    if (existingTeam) {
      await prisma.team.update({
        where: { id: existingTeam.id },
        data: {
          flag: team.flag,
          flagCode: team.flagCode,
          flagImageBytes,
          flagImageMimeType: 'image/jpeg',
          group: team.group,
          odds: team.odds,
          impliedProbability: team.impliedProbability,
          score: team.score,
          rank: team.rank,
        },
      })
      continue
    }

    await prisma.team.create({
      data: {
        name: team.name,
        flag: team.flag,
        flagCode: team.flagCode,
        flagImageBytes,
        flagImageMimeType: 'image/jpeg',
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
