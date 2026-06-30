import { buildOwnerLookup, getFinishedFixtureWinner, normalizeTeamName, unassignedSide } from './matchups'
import type {
  BracketMatchView,
  FanImageKind,
  FormResult,
  GroupStandingView,
  GroupTableView,
  LeaderboardData,
  MatchFixture,
  PlayerLeaderboardRow,
  PersistedDraw,
  TeamSurvivalStatus,
  TeamOwnerView,
  TeamScore,
} from './types'

type MutableStanding = Omit<GroupStandingView, 'position' | 'form'> & {
  form: FormResult[]
}

export type AllocationTeamDisplayState = {
  status: TeamSurvivalStatus
  isAlive: boolean
  isDimmed: boolean
  sortOrder: number
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

const KNOCKOUT_ROUND_LABELS: Record<string, string> = {
  'round of 32': 'Round of 32',
  'round of 16': 'Round of 16',
  'quarter-finals': 'Quarter-finals',
  'quarter-final': 'Quarter-finals',
  'quarter finals': 'Quarter-finals',
  'quarter final': 'Quarter-finals',
  quarterfinals: 'Quarter-finals',
  quarterfinal: 'Quarter-finals',
  'semi-finals': 'Semi-finals',
  'semi-final': 'Semi-finals',
  'semi finals': 'Semi-finals',
  'semi final': 'Semi-finals',
  semifinals: 'Semi-finals',
  semifinal: 'Semi-finals',
  final: 'Final',
  'match for third place': 'Third place',
  'third-place play-off': 'Third place',
  'third place play-off': 'Third place',
  'third-place playoff': 'Third place',
  'third place playoff': 'Third place',
}

function isScoredFixture(fixture: MatchFixture) {
  if (fixture.status !== 'live' && fixture.status !== 'finished') {
    return false
  }

  return typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number'
}

function makeOwnerForTeam(team: TeamScore, owners: Map<string, TeamOwnerView>): TeamOwnerView {
  const owner = owners.get(normalizeTeamName(team.name)) ?? unassignedSide(team.name)

  return {
    ...owner,
    teamName: team.name,
    teamFlagImageUrl: owner.teamFlagImageUrl || team.flagImageUrl || team.flag || null,
    teamScore: owner.teamScore ?? team.score,
    teamRank: owner.teamRank ?? team.rank,
  }
}

function buildInitialStanding(team: TeamScore, owners: Map<string, TeamOwnerView>): MutableStanding {
  return {
    ...makeOwnerForTeam(team, owners),
    group: team.group,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  }
}

function resultFor(goalsFor: number, goalsAgainst: number): FormResult {
  if (goalsFor > goalsAgainst) {
    return 'win'
  }

  if (goalsFor < goalsAgainst) {
    return 'loss'
  }

  return 'draw'
}

function compareStandings(left: MutableStanding, right: MutableStanding) {
  return (
    right.points - left.points ||
    right.goalDifference - left.goalDifference ||
    right.goalsFor - left.goalsFor ||
    left.teamName.localeCompare(right.teamName)
  )
}

function withThreeForm(form: FormResult[]) {
  const emptyForm: FormResult[] = ['empty', 'empty', 'empty']

  return [...form.slice(-3).reverse(), ...emptyForm].slice(0, 3)
}

function roundSortValue(round: string) {
  const normalized = round.toLowerCase()
  return KNOCKOUT_ROUND_ORDER[normalized] ?? 99
}

function knockoutRoundValue(round: string) {
  return KNOCKOUT_ROUND_ORDER[round.toLowerCase()] ?? 0
}

function normalizeKnockoutRound(round: string | null | undefined) {
  const normalized = (round || 'Knockout').toLowerCase()

  return KNOCKOUT_ROUND_LABELS[normalized] ?? round ?? 'Knockout'
}

function isGroupRound(round?: string | null) {
  return !round || /^group\b/i.test(round)
}

function isGroupFixture(fixture: MatchFixture, teamGroups: Map<string, string>) {
  const homeGroup = teamGroups.get(normalizeTeamName(fixture.homeTeam))
  const awayGroup = teamGroups.get(normalizeTeamName(fixture.awayTeam))

  return Boolean(homeGroup && awayGroup && homeGroup === awayGroup)
}

function isKnockoutFixture(fixture: MatchFixture, teamGroups: Map<string, string>) {
  const homeGroup = teamGroups.get(normalizeTeamName(fixture.homeTeam))
  const awayGroup = teamGroups.get(normalizeTeamName(fixture.awayTeam))

  if (homeGroup && awayGroup && homeGroup === awayGroup) {
    return false
  }

  return !isGroupRound(fixture.round)
}

function attachFixtureSide(teamName: string, teamsByName: Map<string, TeamScore>, owners: Map<string, TeamOwnerView>) {
  const team = teamsByName.get(normalizeTeamName(teamName))

  if (team) {
    return makeOwnerForTeam(team, owners)
  }

  return {
    ...unassignedSide(teamName || 'TBD'),
    ownerName: 'TBD',
  }
}

function survivalStatusValue(status: TeamSurvivalStatus) {
  if (status === 'alive') {
    return 2
  }

  if (status === 'pending') {
    return 1
  }

  return 0
}

function makeDisplayState(status: TeamSurvivalStatus, sortOrder: number): AllocationTeamDisplayState {
  return {
    status,
    isAlive: status === 'alive',
    isDimmed: status === 'out',
    sortOrder,
  }
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

export function buildGroupTables(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
): GroupTableView[] {
  const owners = buildOwnerLookup(draw)
  const teamGroups = new Map(teams.map((team) => [normalizeTeamName(team.name), team.group]))
  const standingsByTeam = new Map(
    teams.map((team) => [normalizeTeamName(team.name), buildInitialStanding(team, owners)]),
  )

  for (const fixture of fixtures) {
    if (!isScoredFixture(fixture) || !isGroupFixture(fixture, teamGroups)) {
      continue
    }

    const home = standingsByTeam.get(normalizeTeamName(fixture.homeTeam))
    const away = standingsByTeam.get(normalizeTeamName(fixture.awayTeam))

    if (!home || !away) {
      continue
    }

    const homeScore = fixture.homeScore!
    const awayScore = fixture.awayScore!
    const homeResult = resultFor(homeScore, awayScore)
    const awayResult = resultFor(awayScore, homeScore)

    home.played += 1
    home.goalsFor += homeScore
    home.goalsAgainst += awayScore
    home.goalDifference = home.goalsFor - home.goalsAgainst
    home.form.push(homeResult)

    away.played += 1
    away.goalsFor += awayScore
    away.goalsAgainst += homeScore
    away.goalDifference = away.goalsFor - away.goalsAgainst
    away.form.push(awayResult)

    if (homeResult === 'win') {
      home.won += 1
      home.points += 3
      away.lost += 1
    } else if (homeResult === 'loss') {
      away.won += 1
      away.points += 3
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }

  const byGroup = new Map<string, MutableStanding[]>()

  for (const standing of standingsByTeam.values()) {
    const groupStandings = byGroup.get(standing.group) ?? []
    groupStandings.push(standing)
    byGroup.set(standing.group, groupStandings)
  }

  return [...byGroup.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, standings]) => ({
      group,
      standings: standings.sort(compareStandings).map((standing, index) => ({
        ...standing,
        position: index + 1,
        form: withThreeForm(standing.form),
      })),
    }))
}

export function buildTeamDisplayStates(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
) {
  const groupTables = buildGroupTables(teams, draw, fixtures)
  const bracketMatches = buildBracketMatches(teams, draw, fixtures)
  const states = new Map<string, AllocationTeamDisplayState>()
  const knockoutStates = new Map<string, KnockoutState>()

  for (const group of groupTables) {
    const matchesRequired = Math.max(0, group.standings.length - 1)
    const isComplete = group.standings.every((standing) => standing.played >= matchesRequired)

    for (const standing of group.standings) {
      const status: TeamSurvivalStatus = isComplete
        ? standing.position <= 2
          ? 'alive'
          : 'out'
        : standing.position <= 2
          ? 'alive'
          : 'pending'
      const sortOrder =
        survivalStatusValue(status) * 100 +
        (5 - standing.position) * 10 +
        standing.points * 2 +
        standing.goalDifference / 100

      states.set(normalizeTeamName(standing.teamName), makeDisplayState(status, sortOrder))
    }
  }

  for (const match of bracketMatches) {
    const nextRoundValue = knockoutRoundValue(match.round)

    if (!nextRoundValue) {
      continue
    }

    const winner = getFinishedFixtureWinner(match)

    if (winner) {
      setKnockoutState(knockoutStates, match.home.teamName, {
        isAlive: winner === 'home',
        roundValue: nextRoundValue,
      })
      setKnockoutState(knockoutStates, match.away.teamName, {
        isAlive: winner === 'away',
        roundValue: nextRoundValue,
      })
      continue
    }

    if (match.status === 'finished') {
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
    const status: TeamSurvivalStatus = knockoutState.isAlive ? 'alive' : 'out'
    states.set(teamName, makeDisplayState(status, 300 + knockoutState.roundValue * 20 + (knockoutState.isAlive ? 10 : 0)))
  }

  for (const team of teams) {
    const key = normalizeTeamName(team.name)

    if (!states.has(key)) {
      states.set(key, makeDisplayState('pending', 50 - team.rank / 100))
    }
  }

  return Object.fromEntries(states)
}

export function buildPlayerLeaderboard(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
): PlayerLeaderboardRow[] {
  const displayStates = buildTeamDisplayStates(teams, draw, fixtures)

  return draw.allocation.bundles
    .filter((bundle) => bundle.playerName.trim())
    .map((bundle) => {
      const playerTeams = bundle.teams
        .map((team) => {
          const displayState = displayStates[normalizeTeamName(team.name)]

          return {
            teamName: team.name,
            teamFlagImageUrl: team.flagImageUrl || team.flag || null,
            teamScore: team.score,
            teamRank: team.rank,
            status: displayState?.status ?? 'pending',
            sortOrder: displayState?.sortOrder ?? 0,
          }
        })
        .sort((left, right) => {
          return (
            survivalStatusValue(right.status) - survivalStatusValue(left.status) ||
            right.sortOrder - left.sortOrder ||
            (left.teamRank ?? 999) - (right.teamRank ?? 999) ||
            left.teamName.localeCompare(right.teamName)
          )
        })

      const aliveTeams = playerTeams.filter((team) => team.status === 'alive')
      const outTeams = playerTeams.filter((team) => team.status === 'out')
      const aliveScoreTotal = Number(
        aliveTeams.reduce((sum, team) => sum + (team.teamScore ?? 0), 0).toFixed(2),
      )
      const mood: FanImageKind =
        aliveTeams.length === 0 ? 'devastated' : aliveTeams.length > playerTeams.length / 2 ? 'ecstatic' : 'neutral'

      return {
        slotId: bundle.slotId,
        playerName: bundle.playerName,
        mood,
        ownerSourcePhotoUrl: bundle.sourcePhotoUrl ?? null,
        ownerNeutralPhotoUrl: bundle.fanImageUrls?.neutral ?? null,
        ownerEcstaticPhotoUrl: bundle.fanImageUrls?.ecstatic ?? null,
        ownerDevastatedPhotoUrl: bundle.fanImageUrls?.devastated ?? null,
        aliveTeamCount: aliveTeams.length,
        eliminatedTeamCount: outTeams.length,
        totalTeamCount: playerTeams.length,
        aliveScoreTotal,
        bestAliveTeamRank: aliveTeams.reduce<number | null>((best, team) => {
          if (typeof team.teamRank !== 'number') {
            return best
          }

          return best === null ? team.teamRank : Math.min(best, team.teamRank)
        }, null),
        teams: playerTeams.map((team) => ({
          teamName: team.teamName,
          teamFlagImageUrl: team.teamFlagImageUrl,
          teamScore: team.teamScore,
          teamRank: team.teamRank,
          status: team.status,
        })),
      }
    })
    .sort((left, right) => {
      const leftBestRank = left.bestAliveTeamRank ?? Number.POSITIVE_INFINITY
      const rightBestRank = right.bestAliveTeamRank ?? Number.POSITIVE_INFINITY

      return (
        right.aliveTeamCount - left.aliveTeamCount ||
        right.aliveScoreTotal - left.aliveScoreTotal ||
        leftBestRank - rightBestRank ||
        left.playerName.localeCompare(right.playerName)
      )
    })
}

export function buildBracketMatches(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
): BracketMatchView[] {
  const owners = buildOwnerLookup(draw)
  const teamsByName = new Map(teams.map((team) => [normalizeTeamName(team.name), team]))
  const teamGroups = new Map(teams.map((team) => [normalizeTeamName(team.name), team.group]))

  return fixtures
    .filter((fixture) => isKnockoutFixture(fixture, teamGroups))
    .sort((left, right) => {
      const roundComparison = roundSortValue(left.round ?? '') - roundSortValue(right.round ?? '')

      return roundComparison || Date.parse(left.startsAt) - Date.parse(right.startsAt)
    })
    .map((fixture) => ({
      id: fixture.id,
      round: normalizeKnockoutRound(fixture.round),
      startsAt: fixture.startsAt,
      status: fixture.status,
      statusLabel: fixture.statusLabel,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeWinner: fixture.homeWinner,
      awayWinner: fixture.awayWinner,
      home: attachFixtureSide(fixture.homeTeam, teamsByName, owners),
      away: attachFixtureSide(fixture.awayTeam, teamsByName, owners),
    }))
}

export function buildLeaderboardData(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
  warnings: string[] = [],
): LeaderboardData {
  return {
    groups: buildGroupTables(teams, draw, fixtures),
    bracket: buildBracketMatches(teams, draw, fixtures),
    players: buildPlayerLeaderboard(teams, draw, fixtures),
    warnings,
  }
}
