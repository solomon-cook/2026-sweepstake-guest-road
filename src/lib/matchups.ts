import type {
  MatchFixture,
  MatchOdds,
  MatchupSide,
  MatchupView,
  PersistedDraw,
  TeamOwnerView,
} from './types'

const LIVE_STATUS_CODES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
const UPCOMING_STATUS_CODES = new Set(['NS', 'TBD'])
const FINISHED_STATUS_CODES = new Set(['FT', 'AET', 'PEN'])
const TEAM_NAME_ALIASES: Record<string, string> = {
  turkiye: 'turkey',
  usa: 'unitedstates',
  usmnt: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  coteivoire: 'ivorycoast',
  cotedivoire: 'ivorycoast',
  drcongo: 'drcongo',
  drc: 'drcongo',
  congodr: 'drcongo',
  congodemocraticrepublic: 'drcongo',
  democraticrepublicofthecongo: 'drcongo',
  democraticrepublicofcongo: 'drcongo',
  congokinshasa: 'drcongo',
}

export function normalizeTeamName(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')

  return TEAM_NAME_ALIASES[normalized] ?? normalized
}

export function getFixtureStatus(shortStatus: string | null | undefined): MatchFixture['status'] {
  const code = shortStatus ?? ''

  if (LIVE_STATUS_CODES.has(code)) {
    return 'live'
  }

  if (UPCOMING_STATUS_CODES.has(code)) {
    return 'upcoming'
  }

  if (FINISHED_STATUS_CODES.has(code)) {
    return 'finished'
  }

  return 'unknown'
}

export function selectDisplayFixtures(fixtures: MatchFixture[], limit = 8) {
  const now = Date.now()
  const todayKey = new Date(now).toISOString().slice(0, 10)
  const liveFixtures = fixtures
    .filter((fixture) => fixture.status === 'live')
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
  const upcomingFixtures = fixtures
    .filter((fixture) => {
      if (fixture.status !== 'upcoming') {
        return false
      }

      return fixture.startsAt.slice(0, 10) === todayKey || Date.parse(fixture.startsAt) >= now - 60 * 60 * 1000
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))

  return [...liveFixtures, ...upcomingFixtures].slice(0, limit)
}

export function selectPreviousFixtures(fixtures: MatchFixture[], limit = 16) {
  return fixtures
    .filter((fixture) => fixture.status === 'finished')
    .sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
    .slice(0, limit)
}

export function buildOwnerLookup(draw: PersistedDraw) {
  const lookup = new Map<string, TeamOwnerView>()

  for (const bundle of draw.allocation.bundles) {
    const ownerName = bundle.playerName.trim()

    if (!ownerName) {
      continue
    }

    for (const team of bundle.teams) {
      lookup.set(normalizeTeamName(team.name), {
        teamName: team.name,
        teamFlagImageUrl: team.flagImageUrl || team.flag || null,
        ownerName,
        ownerSourcePhotoUrl: bundle.sourcePhotoUrl ?? null,
        ownerNeutralPhotoUrl: bundle.fanImageUrls?.neutral ?? null,
        ownerEcstaticPhotoUrl: bundle.fanImageUrls?.ecstatic ?? null,
        ownerDevastatedPhotoUrl: bundle.fanImageUrls?.devastated ?? null,
        teamScore: team.score,
        teamRank: team.rank,
        isAssigned: true,
      })
    }
  }

  return lookup
}

export function unassignedSide(teamName: string): TeamOwnerView {
  return {
    teamName,
    teamFlagImageUrl: null,
    ownerName: 'Unassigned',
    ownerSourcePhotoUrl: null,
    ownerNeutralPhotoUrl: null,
    ownerEcstaticPhotoUrl: null,
    ownerDevastatedPhotoUrl: null,
    teamScore: null,
    teamRank: null,
    isAssigned: false,
  }
}

export function selectMatchupOwnerPhoto(
  side: MatchupSide,
  ownScore?: number | null,
  opponentScore?: number | null,
) {
  if (typeof ownScore === 'number' && typeof opponentScore === 'number') {
    if (ownScore > opponentScore) {
      return side.ownerEcstaticPhotoUrl || side.ownerNeutralPhotoUrl || side.ownerSourcePhotoUrl || null
    }

    if (ownScore < opponentScore) {
      return side.ownerDevastatedPhotoUrl || side.ownerNeutralPhotoUrl || side.ownerSourcePhotoUrl || null
    }
  }

  return side.ownerNeutralPhotoUrl || side.ownerSourcePhotoUrl || null
}

function formatDecimalOdds(probability: number) {
  return (1 / probability).toFixed(2)
}

export function calculateLocalMatchOdds(home: MatchupSide, away: MatchupSide): MatchOdds | null {
  const homeScore = home.teamScore
  const awayScore = away.teamScore

  if (!homeScore || !awayScore || homeScore <= 0 || awayScore <= 0) {
    return null
  }

  const total = homeScore + awayScore
  const homeProbability = homeScore / total
  const awayProbability = awayScore / total

  return {
    home: formatDecimalOdds(homeProbability),
    draw: null,
    away: formatDecimalOdds(awayProbability),
    homeProbability,
    awayProbability,
    source: 'Calculated from sweepstake scores',
  }
}

export function buildMatchups(
  draw: PersistedDraw,
  fixtures: MatchFixture[],
  oddsByFixtureId: Record<string, MatchOdds | null | undefined>,
) {
  const owners = buildOwnerLookup(draw)
  const warnings: string[] = []
  const matchups: MatchupView[] = fixtures.map((fixture) => {
    const home = owners.get(normalizeTeamName(fixture.homeTeam)) ?? unassignedSide(fixture.homeTeam)
    const away = owners.get(normalizeTeamName(fixture.awayTeam)) ?? unassignedSide(fixture.awayTeam)

    if (!home.isAssigned) {
      warnings.push(`No sweepstake owner found for ${fixture.homeTeam}.`)
    }

    if (!away.isAssigned) {
      warnings.push(`No sweepstake owner found for ${fixture.awayTeam}.`)
    }

    return {
      fixture,
      home,
      away,
      odds: oddsByFixtureId[fixture.id] ?? calculateLocalMatchOdds(home, away),
    }
  })

  return {
    matchups,
    warnings,
  }
}
