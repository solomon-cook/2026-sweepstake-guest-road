import { buildGroupTables, buildTeamDisplayStates } from './leaderboard'
import { normalizeTeamName } from './matchups'
import type { FanImageKind, FixtureStatus, MatchFixture, PersistedDraw, TeamScore } from './types'

export type AllocationTeamFixtureSummary = {
  id: string
  startsAt: string
  status: FixtureStatus
  statusLabel: string
  round?: string | null
  venue?: string | null
  opponentName: string
  opponentFlagImageUrl?: string | null
  isHome: boolean
  teamScore?: number | null
  opponentScore?: number | null
  result: 'win' | 'draw' | 'loss' | 'pending'
}

export type AllocationTeamDetail = {
  teamName: string
  teamFlagImageUrl?: string | null
  group: string
  rank: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  isAlive: boolean
  isDimmed: boolean
  groupStageMatchups: AllocationTeamFixtureSummary[]
  nextMatchup: AllocationTeamFixtureSummary | null
  previousMatchups: AllocationTeamFixtureSummary[]
}

export type AllocationDisplayState = {
  bundleMoodBySlotId: Record<string, FanImageKind>
  teamsByName: ReturnType<typeof buildTeamDisplayStates>
  teamDetailsByName: Record<string, AllocationTeamDetail>
}

type AllocationTeamDisplayState = ReturnType<typeof buildTeamDisplayStates>[string]
type FixtureSide = 'home' | 'away'

const PREVIOUS_MATCHUP_LIMIT = 5
const GROUP_STAGE_MATCHUP_LIMIT = 5

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

function fixtureSideForTeam(fixture: MatchFixture, teamName: string): FixtureSide | null {
  const key = normalizeTeamName(teamName)

  if (normalizeTeamName(fixture.homeTeam) === key) {
    return 'home'
  }

  if (normalizeTeamName(fixture.awayTeam) === key) {
    return 'away'
  }

  return null
}

function resultForScore(teamScore?: number | null, opponentScore?: number | null) {
  if (typeof teamScore !== 'number' || typeof opponentScore !== 'number') {
    return 'pending' as const
  }

  if (teamScore > opponentScore) {
    return 'win' as const
  }

  if (teamScore < opponentScore) {
    return 'loss' as const
  }

  return 'draw' as const
}

function summarizeFixtureForTeam(
  fixture: MatchFixture,
  side: FixtureSide,
  teamsByName: Map<string, TeamScore>,
): AllocationTeamFixtureSummary {
  const isHome = side === 'home'
  const opponentName = isHome ? fixture.awayTeam : fixture.homeTeam
  const teamScore = isHome ? fixture.homeScore : fixture.awayScore
  const opponentScore = isHome ? fixture.awayScore : fixture.homeScore
  const opponent = teamsByName.get(normalizeTeamName(opponentName))

  return {
    id: fixture.id,
    startsAt: fixture.startsAt,
    status: fixture.status,
    statusLabel: fixture.statusLabel,
    round: fixture.round,
    venue: fixture.venue,
    opponentName,
    opponentFlagImageUrl: opponent?.flagImageUrl || opponent?.flag || null,
    isHome,
    teamScore,
    opponentScore,
    result: resultForScore(teamScore, opponentScore),
  }
}

function selectNextMatchup(
  teamName: string,
  fixtures: MatchFixture[],
  teamsByName: Map<string, TeamScore>,
): AllocationTeamFixtureSummary | null {
  const liveFixtures = fixtures
    .filter((fixture) => fixture.status === 'live' && fixtureSideForTeam(fixture, teamName))
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))

  const nextFixture =
    liveFixtures[0] ??
    fixtures
      .filter((fixture) => fixture.status === 'upcoming' && fixtureSideForTeam(fixture, teamName))
      .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))[0]

  const side = nextFixture ? fixtureSideForTeam(nextFixture, teamName) : null

  return nextFixture && side ? summarizeFixtureForTeam(nextFixture, side, teamsByName) : null
}

function selectPreviousMatchups(
  teamName: string,
  fixtures: MatchFixture[],
  teamsByName: Map<string, TeamScore>,
) {
  return fixtures
    .flatMap((fixture) => {
      const side = fixture.status === 'finished' ? fixtureSideForTeam(fixture, teamName) : null

      return side ? [summarizeFixtureForTeam(fixture, side, teamsByName)] : []
    })
    .sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
    .slice(0, PREVIOUS_MATCHUP_LIMIT)
}

function isGroupRound(round?: string | null) {
  return !round || /^group\b/i.test(round)
}

function selectGroupStageMatchups(
  team: TeamScore,
  fixtures: MatchFixture[],
  teamsByName: Map<string, TeamScore>,
) {
  return fixtures
    .flatMap((fixture) => {
      const side = isGroupRound(fixture.round) ? fixtureSideForTeam(fixture, team.name) : null

      if (!side) {
        return []
      }

      const opponentName = side === 'home' ? fixture.awayTeam : fixture.homeTeam
      const opponent = teamsByName.get(normalizeTeamName(opponentName))

      return opponent?.group === team.group ? [summarizeFixtureForTeam(fixture, side, teamsByName)] : []
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, GROUP_STAGE_MATCHUP_LIMIT)
}

function buildTeamDetails(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
  displayStates: Record<string, AllocationTeamDisplayState>,
) {
  const teamsByName = new Map(teams.map((team) => [normalizeTeamName(team.name), team]))
  const standingsByName = new Map(
    buildGroupTables(teams, draw, fixtures).flatMap((group) =>
      group.standings.map((standing) => [normalizeTeamName(standing.teamName), standing] as const),
    ),
  )

  return Object.fromEntries(
    teams.map((team) => {
      const key = normalizeTeamName(team.name)
      const standing = standingsByName.get(key)
      const displayState = displayStates[key]

      return [
        key,
        {
          teamName: team.name,
          teamFlagImageUrl: team.flagImageUrl || team.flag || null,
          group: team.group,
          rank: team.rank,
          played: standing?.played ?? 0,
          won: standing?.won ?? 0,
          drawn: standing?.drawn ?? 0,
          lost: standing?.lost ?? 0,
          goalsFor: standing?.goalsFor ?? 0,
          goalsAgainst: standing?.goalsAgainst ?? 0,
          goalDifference: standing?.goalDifference ?? 0,
          points: standing?.points ?? 0,
          isAlive: displayState?.isAlive ?? false,
          isDimmed: displayState?.isDimmed ?? false,
          groupStageMatchups: selectGroupStageMatchups(team, fixtures, teamsByName),
          nextMatchup: selectNextMatchup(team.name, fixtures, teamsByName),
          previousMatchups: selectPreviousMatchups(team.name, fixtures, teamsByName),
        },
      ]
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
    teamDetailsByName: buildTeamDetails(teams, draw, fixtures, teamsByName),
    bundleMoodBySlotId: selectBundleMood(draw, teamsByName),
  }
}
