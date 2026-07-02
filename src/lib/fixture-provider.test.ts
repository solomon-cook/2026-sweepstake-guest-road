import { describe, expect, test } from 'vitest'
import { mergeFixtures } from './fixture-provider'
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
      statusLabel: 'Final',
      homePenaltyScore: 5,
      awayPenaltyScore: 4,
      homeWinner: true,
      awayWinner: false,
    })
  })
})
