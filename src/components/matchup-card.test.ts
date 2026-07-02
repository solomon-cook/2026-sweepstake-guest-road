import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { MatchupCard } from './matchup-card'
import type { MatchFixture, MatchupView } from '@/lib/types'

const homeSide = {
  teamName: 'France',
  teamFlagImageUrl: null,
  ownerName: 'Sam',
  ownerSourcePhotoUrl: null,
  ownerNeutralPhotoUrl: null,
  ownerEcstaticPhotoUrl: null,
  ownerDevastatedPhotoUrl: null,
  teamScore: 9,
  teamRank: 1,
  isAssigned: true,
}

const awaySide = {
  teamName: 'Spain',
  teamFlagImageUrl: null,
  ownerName: 'Dan',
  ownerSourcePhotoUrl: null,
  ownerNeutralPhotoUrl: null,
  ownerEcstaticPhotoUrl: null,
  ownerDevastatedPhotoUrl: null,
  teamScore: 8,
  teamRank: 2,
  isAssigned: true,
}

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

function matchup(fixtureOverrides: Partial<MatchFixture>): MatchupView {
  return {
    fixture: fixture(fixtureOverrides),
    home: homeSide,
    away: awaySide,
    odds: null,
  }
}

function renderMatchupCard(view: MatchupView) {
  return renderToStaticMarkup(createElement(MatchupCard, { matchup: view, label: 'Previous match' }))
}

describe('MatchupCard penalty scores', () => {
  test('renders penalty shootout scores under the main score', () => {
    const html = renderMatchupCard(
      matchup({
        statusLabel: 'FT-Pens',
        homePenaltyScore: 5,
        awayPenaltyScore: 4,
        homeWinner: true,
        awayWinner: false,
      }),
    )

    expect(html).toContain('1 - 1')
    expect(html).toContain('Pens 5 - 4')
    expect(html).toContain('compact-matchup-penalties')
  })

  test('does not render a penalty line for normal finished scores', () => {
    const html = renderMatchupCard(
      matchup({
        homeScore: 2,
        awayScore: 0,
      }),
    )

    expect(html).toContain('2 - 0')
    expect(html).not.toContain('Pens')
    expect(html).not.toContain('compact-matchup-penalties')
  })
})
