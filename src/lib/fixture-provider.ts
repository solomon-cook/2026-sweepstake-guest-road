import {
  buildMatchups,
  getFixtureStatus,
  normalizeTeamName,
  selectDisplayFixtures,
  selectPreviousFixtures,
} from './matchups'
import { getPrismaClient } from './prisma'
import type { MatchFixture, MatchupView, PersistedDraw } from './types'

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'
const OPENFOOTBALL_WORLD_CUP_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
const ESPN_FIXTURE_CACHE_KEY = 'espn:fifa-world-cup-2026:scoreboard:v2'
const OPENFOOTBALL_FIXTURE_CACHE_KEY = 'openfootball:world-cup-2026:fixtures:v2'
const ESPN_CACHE_MS = 90 * 1000
const OPENFOOTBALL_CACHE_MS = 30 * 60 * 1000

type CachedPayload<T> = {
  payload: T
  fetchedAt: Date
}

type EspnScoreboard = {
  events?: Array<{
    id?: string
    name?: string
    date?: string
    status?: {
      type?: {
        state?: string
        completed?: boolean
        description?: string
        detail?: string
        shortDetail?: string
      }
    }
    competitions?: Array<{
      venue?: {
        fullName?: string
      }
      competitors?: Array<{
        homeAway?: string
        winner?: boolean
        score?: string
        team?: {
          displayName?: string
        }
      }>
    }>
  }>
}

type OpenFootballSchedule = {
  matches?: Array<{
    round?: string
    date?: string
    time?: string
    team1?: string
    team2?: string
    score?: {
      ft?: [number, number]
      et?: [number, number]
      p?: [number, number]
    }
    group?: string
    ground?: string
  }>
}

async function readCache<T>(key: string): Promise<CachedPayload<T> | null> {
  const prisma = getPrismaClient()
  const cached = await prisma.apiCache.findUnique({
    where: { key },
  })

  if (!cached) {
    return null
  }

  return {
    payload: cached.payload as T,
    fetchedAt: cached.fetchedAt,
  }
}

async function writeCache<T>(key: string, payload: T) {
  const prisma = getPrismaClient()

  await prisma.apiCache.upsert({
    where: { key },
    create: {
      key,
      payload: payload as never,
      fetchedAt: new Date(),
    },
    update: {
      payload: payload as never,
      fetchedAt: new Date(),
    },
  })
}

function isCacheFresh(cached: CachedPayload<unknown>, maxAgeMs: number) {
  return Date.now() - cached.fetchedAt.getTime() < maxAgeMs
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Fixture request failed with status ${response.status}.`)
  }

  return (await response.json()) as T
}

function normalizeEspnStatus(state: string | undefined, completed: boolean | undefined): MatchFixture['status'] {
  if (completed) {
    return 'finished'
  }

  if (state === 'in') {
    return 'live'
  }

  if (state === 'pre') {
    return 'upcoming'
  }

  return 'unknown'
}

function normalizeEspnFixture(event: NonNullable<EspnScoreboard['events']>[number]): MatchFixture | null {
  const competition = event.competitions?.[0]
  const home = competition?.competitors?.find((competitor) => competitor.homeAway === 'home')
  const away = competition?.competitors?.find((competitor) => competitor.homeAway === 'away')
  const status = normalizeEspnStatus(event.status?.type?.state, event.status?.type?.completed)
  const showScore = status === 'live' || status === 'finished'

  if (!event.id || !event.date || !home?.team?.displayName || !away?.team?.displayName) {
    return null
  }

  return {
    id: `espn-${event.id}`,
    startsAt: event.date,
    status,
    statusLabel:
      event.status?.type?.shortDetail ??
      event.status?.type?.detail ??
      event.status?.type?.description ??
      'Unknown',
    round: null,
    venue: competition?.venue?.fullName ?? null,
    homeTeam: home.team.displayName,
    awayTeam: away.team.displayName,
    homeScore: showScore && home.score ? Number(home.score) : null,
    awayScore: showScore && away.score ? Number(away.score) : null,
    homePenaltyScore: null,
    awayPenaltyScore: null,
    homeWinner: status === 'finished' && typeof home.winner === 'boolean' ? home.winner : null,
    awayWinner: status === 'finished' && typeof away.winner === 'boolean' ? away.winner : null,
  }
}

function parseOpenFootballDate(date: string, time: string | undefined) {
  const match = /^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})$/.exec(time ?? '')

  if (!match) {
    return `${date}T00:00:00.000Z`
  }

  const [, hour, minute, offset] = match
  const offsetNumber = Number(offset)
  const offsetString = `${offsetNumber >= 0 ? '+' : '-'}${String(Math.abs(offsetNumber)).padStart(2, '0')}:00`

  return new Date(`${date}T${hour.padStart(2, '0')}:${minute}:00${offsetString}`).toISOString()
}

function normalizeOpenFootballFixture(
  match: NonNullable<OpenFootballSchedule['matches']>[number],
  index: number,
): MatchFixture | null {
  if (!match.date || !match.team1 || !match.team2) {
    return null
  }

  const hasScore = Array.isArray(match.score?.ft)
  const penaltyScore = match.score?.p
  const hasPenaltyScore = Array.isArray(penaltyScore)
  const extraTimeScore = match.score?.et
  const statusLabel = hasPenaltyScore ? 'FT-Pens' : Array.isArray(extraTimeScore) ? 'AET' : hasScore ? 'FT' : 'Scheduled'
  const homePenaltyWon = hasPenaltyScore ? penaltyScore[0] > penaltyScore[1] : null
  const awayPenaltyWon = hasPenaltyScore ? penaltyScore[1] > penaltyScore[0] : null

  return {
    id: `openfootball-${index + 1}`,
    startsAt: parseOpenFootballDate(match.date, match.time),
    status: hasScore ? 'finished' : getFixtureStatus('NS'),
    statusLabel,
    round: match.round ?? match.group ?? null,
    venue: match.ground ?? null,
    homeTeam: match.team1,
    awayTeam: match.team2,
    homeScore: match.score?.ft?.[0] ?? null,
    awayScore: match.score?.ft?.[1] ?? null,
    homePenaltyScore: penaltyScore?.[0] ?? null,
    awayPenaltyScore: penaltyScore?.[1] ?? null,
    homeWinner: homePenaltyWon,
    awayWinner: awayPenaltyWon,
  }
}

async function loadCachedFixtures<T>(
  key: string,
  maxAgeMs: number,
  fetcher: () => Promise<T>,
): Promise<{ payload: T | null; warning: string | null }> {
  const cached = await readCache<T>(key)

  if (cached && isCacheFresh(cached, maxAgeMs)) {
    return { payload: cached.payload, warning: null }
  }

  try {
    const payload = await fetcher()
    await writeCache(key, payload)
    return { payload, warning: null }
  } catch (error) {
    if (cached) {
      return {
        payload: cached.payload,
        warning:
          error instanceof Error
            ? `Showing cached fixture data because refresh failed: ${error.message}`
            : 'Showing cached fixture data because refresh failed.',
      }
    }

    return {
      payload: null,
      warning: error instanceof Error ? error.message : 'Fixture data is unavailable.',
    }
  }
}

function mergeFixtureData(fallbackFixture: MatchFixture, primaryFixture: MatchFixture): MatchFixture {
  return {
    ...fallbackFixture,
    ...primaryFixture,
    homePenaltyScore: primaryFixture.homePenaltyScore ?? fallbackFixture.homePenaltyScore ?? null,
    awayPenaltyScore: primaryFixture.awayPenaltyScore ?? fallbackFixture.awayPenaltyScore ?? null,
    homeWinner: primaryFixture.homeWinner ?? fallbackFixture.homeWinner ?? null,
    awayWinner: primaryFixture.awayWinner ?? fallbackFixture.awayWinner ?? null,
  }
}

export function mergeFixtures(primaryFixtures: MatchFixture[], fallbackFixtures: MatchFixture[]) {
  const merged = new Map<string, MatchFixture>()

  for (const fixture of fallbackFixtures) {
    merged.set(buildFixtureMergeKey(fixture), fixture)
  }

  for (const fixture of primaryFixtures) {
    const key = buildFixtureMergeKey(fixture)
    const fallbackFixture = merged.get(key)

    merged.set(key, fallbackFixture ? mergeFixtureData(fallbackFixture, fixture) : fixture)
  }

  return [...merged.values()]
}

function buildFixtureMergeKey(fixture: MatchFixture) {
  return [
    fixture.startsAt.slice(0, 10),
    normalizeTeamName(fixture.homeTeam),
    normalizeTeamName(fixture.awayTeam),
  ].join(':')
}

export async function loadFixtures() {
  const warnings: string[] = []
  const espnResult = await loadCachedFixtures(ESPN_FIXTURE_CACHE_KEY, ESPN_CACHE_MS, async () => {
    const scoreboard = await fetchJson<EspnScoreboard>(ESPN_SCOREBOARD_URL)
    return (scoreboard.events ?? []).flatMap((event) => {
      const fixture = normalizeEspnFixture(event)
      return fixture ? [fixture] : []
    })
  })
  const openFootballResult = await loadCachedFixtures(OPENFOOTBALL_FIXTURE_CACHE_KEY, OPENFOOTBALL_CACHE_MS, async () => {
    const schedule = await fetchJson<OpenFootballSchedule>(OPENFOOTBALL_WORLD_CUP_URL)
    return (schedule.matches ?? []).flatMap((match, index) => {
      const fixture = normalizeOpenFootballFixture(match, index)
      return fixture ? [fixture] : []
    })
  })

  if (espnResult.warning) {
    warnings.push(`ESPN: ${espnResult.warning}`)
  }

  if (openFootballResult.warning) {
    warnings.push(`OpenFootball: ${openFootballResult.warning}`)
  }

  const fixtures = mergeFixtures(espnResult.payload ?? [], openFootballResult.payload ?? [])

  return { fixtures, warnings }
}

export async function loadMatchupData(draw: PersistedDraw): Promise<{
  status: 'ready'
  matchups: MatchupView[]
  previousMatchups: MatchupView[]
  warnings: string[]
}> {
  const fixtureResult = await loadFixtures()
  const displayFixtures = selectDisplayFixtures(fixtureResult.fixtures)
  const previousFixtures = selectPreviousFixtures(fixtureResult.fixtures)
  const matchupResult = buildMatchups(draw, displayFixtures, {})
  const previousMatchupResult = buildMatchups(draw, previousFixtures, {})

  return {
    status: 'ready',
    matchups: matchupResult.matchups,
    previousMatchups: previousMatchupResult.matchups,
    warnings: [...fixtureResult.warnings, ...matchupResult.warnings, ...previousMatchupResult.warnings],
  }
}
