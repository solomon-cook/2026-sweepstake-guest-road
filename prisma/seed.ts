import { PrismaClient } from '@prisma/client'
import { TEAM_SEED_SCORES } from '../src/lib/team-source'

const prisma = new PrismaClient()

async function main() {
  await prisma.team.createMany({
    data: TEAM_SEED_SCORES.map((team) => ({
      name: team.name,
      group: team.group,
      odds: team.odds,
      impliedProbability: team.impliedProbability,
      score: team.score,
      rank: team.rank,
    })),
    skipDuplicates: true,
  })
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
