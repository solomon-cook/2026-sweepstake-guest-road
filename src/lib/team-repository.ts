import { getPrismaClient } from './prisma'
import type { TeamScore } from './types'

function buildFlagImageUrl(teamId: string) {
  return `/api/team-flags/${teamId}`
}

type TeamLoadResult =
  | { status: 'ready'; teams: TeamScore[] }
  | { status: 'empty' }
  | { status: 'error'; message: string }

export async function loadTeamScores(): Promise<TeamLoadResult> {
  try {
    const prisma = getPrismaClient()
    const teams = await prisma.team.findMany({
      orderBy: {
        rank: 'asc',
      },
    })

    if (!teams.length) {
      return { status: 'empty' }
    }

    return {
      status: 'ready',
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        flag: team.flag,
        flagCode: team.flagCode,
        flagImageUrl: buildFlagImageUrl(team.id),
        group: team.group,
        odds: team.odds,
        impliedProbability: team.impliedProbability,
        score: team.score,
        rank: team.rank,
      })),
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown database error while loading teams.'

    return {
      status: 'error',
      message,
    }
  }
}
