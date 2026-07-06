import { describe, expect, test } from 'vitest'
import { mergeFixtures, normalizeEspnFixture, normalizeOpenFootballFixture } from './fixture-provider'
import type { MatchFixture } from './types'

function fixture(overrides: Partial<MatchFixture>): MatchFixture {
  return {
    id: 'fixture-1',
    startsAt: '2026-07-19T19:00:00.000Z',
    status: 'finished',
    statusLabel: 'FT',
    homeTeam: 'France',
    awayTeam: 'Spain',
    homeScore: 1,
    awayScore: 1,
    homePenaltyScore: null,
    awayPenaltyScore: null,
    homeWinner: null,
    awayWinner: null,
    ...overrides,
  }
}

describe('fixture provider merge', () => {
  test('keeps fallback penalty scores and winners when primary fixtures omit them', () => {
    const primaryFixture = fixture({
      id: 'espn-1',
      statusLabel: 'Final',
    })
    const fallbackFixture = fixture({
      id: 'openfootball-1',
      statusLabel: 'FT-Pens',
      homePenaltyScore: 5,
      awayPenaltyScore: 4,
      homeWinner: true,
      awayWinner: false,
    })

    const [merged] = mergeFixtures([primaryFixture], [fallbackFixture])

    expect(merged).toMatchObject({
      id: 'espn-1',
      statusLabel: 'FT-Pens',
      homePenaltyScore: 5,
      awayPenaltyScore: 4,
      homeWinner: true,
      awayWinner: false,
    })
  })

  test('keeps fallback extra-time final score when primary score is only level after full time', () => {
    const primaryFixture = fixture({
      id: 'espn-1',
      statusLabel: 'Final',
      homeTeam: 'Belgium',
      awayTeam: 'Senegal',
      homeScore: 2,
      awayScore: 2,
    })
    const fallbackFixture = fixture({
      id: 'openfootball-1',
      statusLabel: 'AET',
      homeTeam: 'Belgium',
      awayTeam: 'Senegal',
      homeScore: 3,
      awayScore: 2,
    })

    const [merged] = mergeFixtures([primaryFixture], [fallbackFixture])

    expect(merged).toMatchObject({
      id: 'espn-1',
      statusLabel: 'AET',
      homeTeam: 'Belgium',
      awayTeam: 'Senegal',
      homeScore: 3,
      awayScore: 2,
    })
  })

  test('keeps fallback round and venue when primary fixtures omit them', () => {
    const primaryFixture = fixture({
      id: 'espn-1',
      round: null,
      venue: null,
      homeTeam: 'Portugal',
      awayTeam: 'Spain',
      status: 'live',
      statusLabel: "45'",
      homeScore: 1,
      awayScore: 0,
    })
    const fallbackFixture = fixture({
      id: 'openfootball-1',
      round: 'Round of 16',
      venue: 'Dallas Stadium',
      knockoutOrder: 93,
      homeTeam: 'Portugal',
      awayTeam: 'Spain',
      status: 'upcoming',
      statusLabel: 'Scheduled',
      homeScore: null,
      awayScore: null,
    })

    const [merged] = mergeFixtures([primaryFixture], [fallbackFixture])

    expect(merged).toMatchObject({
      id: 'espn-1',
      round: 'Round of 16',
      venue: 'Dallas Stadium',
      knockoutOrder: 93,
      status: 'live',
      statusLabel: "45'",
      homeScore: 1,
      awayScore: 0,
    })
  })
})

describe('OpenFootball fixture normalization', () => {
  test('uses the final extra-time score for AET fixtures', () => {
    const normalized = normalizeOpenFootballFixture(
      {
        round: 'Round of 16',
        date: '2026-07-05',
        time: '20:00 UTC-4',
        team1: 'France',
        team2: 'Spain',
        score: {
          ft: [1, 1],
          et: [2, 1],
        },
      },
      0,
    )

    expect(normalized).toMatchObject({
      status: 'finished',
      statusLabel: 'AET',
      homeScore: 2,
      awayScore: 1,
    })
  })

  test('uses the score after extra time before showing penalties', () => {
    const normalized = normalizeOpenFootballFixture(
      {
        round: 'Quarter-finals',
        date: '2026-07-11',
        time: '20:00 UTC-4',
        team1: 'Brazil',
        team2: 'Argentina',
        score: {
          ft: [1, 1],
          et: [2, 2],
          p: [5, 4],
        },
      },
      1,
    )

    expect(normalized).toMatchObject({
      status: 'finished',
      statusLabel: 'FT-Pens',
      homeScore: 2,
      awayScore: 2,
      homePenaltyScore: 5,
      awayPenaltyScore: 4,
      homeWinner: true,
      awayWinner: false,
    })
  })
})

describe('ESPN fixture normalization', () => {
  test('keeps zero scores for live and finished fixtures', () => {
    const normalized = normalizeEspnFixture({
      id: '123',
      date: '2026-06-14T20:00:00.000Z',
      status: {
        type: {
          completed: true,
          shortDetail: 'FT',
          state: 'post',
        },
      },
      competitions: [
        {
          competitors: [
            {
              homeAway: 'home',
              score: '0',
              team: {
                displayName: 'France',
              },
            },
            {
              homeAway: 'away',
              score: '2',
              team: {
                displayName: 'Spain',
              },
            },
          ],
        },
      ],
    })

    expect(normalized).toMatchObject({
      homeScore: 0,
      awayScore: 2,
    })
  })
})
