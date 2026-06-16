import { buildBracketMatches, buildGroupTables } from './leaderboard'
import { normalizeTeamName } from './matchups'
import type { FanImageKind, MatchFixture, PersistedDraw, TeamScore } from './types'

export type AllocationTeamDisplayState = {
  isAlive: boolean
  isDimmed: boolean
  sortOrder: number
}

export type AllocationDisplayState = {
  bundleMoodBySlotId: Record<string, FanImageKind>
  teamsByName: Record<string, AllocationTeamDisplayState>
}

type KnockoutState = {
  isAlive: boolean
  roundValue: number
}

const KNOCKOUT_ROUND_ORDER: Record<string, number> = {
  'round of 32': 1,
  'round of 16': 2,
  'quarter-finals': 3,
  'quarter-final': 3,
  'quarter finals': 3,
  'quarter final': 3,
  quarterfinals: 3,
  quarterfinal: 3,
  'semi-finals': 4,
  'semi-final': 4,
  'semi finals': 4,
  'semi final': 4,
  semifinals: 4,
  semifinal: 4,
  final: 5,
  'match for third place': 6,
  'third-place play-off': 6,
  'third place play-off': 6,
  'third-place playoff': 6,
  'third place playoff': 6,
}

function roundValue(round: string) {
  return KNOCKOUT_ROUND_ORDER[round.toLowerCase()] ?? 0
}

function isResolvedMatch(homeScore?: number | null, awayScore?: number | null) {
  return typeof homeScore === 'number' && typeof awayScore === 'number' && homeScore !== awayScore
}

function setKnockoutState(
  states: Map<string, KnockoutState>,
  teamName: string,
  nextState: KnockoutState,
) {
  if (!teamName || teamName === 'TBD') {
    return
  }

  const key = normalizeTeamName(teamName)
  const current = states.get(key)

  if (
    !current ||
    nextState.roundValue > current.roundValue ||
    (nextState.roundValue === current.roundValue && current.isAlive !== nextState.isAlive)
  ) {
    states.set(key, nextState)
  }
}

function buildTeamDisplayStates(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
) {
  const groupTables = buildGroupTables(teams, draw, fixtures)
  const bracketMatches = buildBracketMatches(teams, draw, fixtures)
  const states = new Map<string, AllocationTeamDisplayState>()
  const knockoutStates = new Map<string, KnockoutState>()

  for (const group of groupTables) {
    for (const standing of group.standings) {
      const isAlive = standing.position <= 2
      const sortOrder =
        (isAlive ? 100 : 0) +
        (5 - standing.position) * 10 +
        standing.points * 2 +
        standing.goalDifference / 100

      states.set(normalizeTeamName(standing.teamName), {
        isAlive,
        isDimmed: !isAlive,
        sortOrder,
      })
    }
  }

  for (const match of bracketMatches) {
    const nextRoundValue = roundValue(match.round)

    if (!nextRoundValue) {
      continue
    }

    if (isResolvedMatch(match.homeScore, match.awayScore)) {
      const homeWon = match.homeScore! > match.awayScore!

      setKnockoutState(knockoutStates, match.home.teamName, {
        isAlive: homeWon,
        roundValue: nextRoundValue,
      })
      setKnockoutState(knockoutStates, match.away.teamName, {
        isAlive: !homeWon,
        roundValue: nextRoundValue,
      })
      continue
    }

    setKnockoutState(knockoutStates, match.home.teamName, {
      isAlive: true,
      roundValue: nextRoundValue,
    })
    setKnockoutState(knockoutStates, match.away.teamName, {
      isAlive: true,
      roundValue: nextRoundValue,
    })
  }

  for (const [teamName, knockoutState] of knockoutStates) {
    states.set(teamName, {
      isAlive: knockoutState.isAlive,
      isDimmed: !knockoutState.isAlive,
      sortOrder: 200 + knockoutState.roundValue * 20 + (knockoutState.isAlive ? 10 : 0),
    })
  }

  for (const team of teams) {
    const key = normalizeTeamName(team.name)

    if (!states.has(key)) {
      states.set(key, {
        isAlive: false,
        isDimmed: false,
        sortOrder: 50 - team.rank / 100,
      })
    }
  }

  return Object.fromEntries(states)
}

function selectBundleMood(draw: PersistedDraw, teamsByName: Record<string, AllocationTeamDisplayState>) {
  return Object.fromEntries(
    draw.allocation.bundles.map((bundle) => {
      const aliveTeamCount = bundle.teams.filter((team) => teamsByName[normalizeTeamName(team.name)]?.isAlive).length
      const mood: FanImageKind =
        aliveTeamCount === 0 ? 'devastated' : aliveTeamCount > bundle.teams.length / 2 ? 'ecstatic' : 'neutral'

      return [bundle.slotId, mood]
    }),
  )
}

export function buildAllocationDisplayState(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
): AllocationDisplayState {
  const teamsByName = buildTeamDisplayStates(teams, draw, fixtures)

  return {
    teamsByName,
    bundleMoodBySlotId: selectBundleMood(draw, teamsByName),
  }
}
