import { describe, expect, test } from 'vitest'
import { toPersistedDraw } from './draw-repository'
import { buildBracketMatches, buildGroupTables } from './leaderboard'
import { TEAM_SEED_SCORES } from './team-source'
import type { MatchFixture, PersistedDraw } from './types'

function team(name: string) {
  const found = TEAM_SEED_SCORES.find((candidate) => candidate.name === name)

  if (!found) {
    throw new Error(`Missing test team: ${name}`)
  }

  return found
}

function makeDraw(): PersistedDraw {
  const mexico = team('Mexico')
  const southKorea = team('South Korea')
  const czechRepublic = team('Czech Republic')

  return toPersistedDraw(7, [
    {
      id: 'slot-mexico',
      slotIndex: 0,
      playerName: 'Solomon',
      photoMimeType: 'image/jpeg',
      photoData: Buffer.from('photo'),
      generatedImageMimeType: 'image/jpeg',
      neutralImageData: Buffer.from('neutral'),
      totalScore: 10,
      isRevealed: true,
      teamAssignments: [{ teamOrder: 0, team: mexico }],
    },
    {
      id: 'slot-korea-czechia',
      slotIndex: 1,
      playerName: 'Dan',
      totalScore: 8,
      isRevealed: true,
      teamAssignments: [
        { teamOrder: 0, team: southKorea },
        { teamOrder: 1, team: czechRepublic },
      ],
    },
  ])
}

function fixture(overrides: Partial<MatchFixture>): MatchFixture {
  return {
    id: 'fixture-1',
    startsAt: '2026-06-14T19:00:00.000Z',
    status: 'finished',
    statusLabel: 'FT',
    round: 'Group A',
    homeTeam: 'Mexico',
    awayTeam: 'South Korea',
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  }
}

describe('leaderboard group tables', () => {
  test('calculates standings and last-five form from scored group fixtures', () => {
    const tables = buildGroupTables(
      [team('Mexico'), team('South Korea'), team('Czech Republic'), team('South Africa')],
      makeDraw(),
      [
        fixture({ id: 'mex-kor', homeTeam: 'Mexico', awayTeam: 'South Korea', homeScore: 2, awayScore: 1 }),
        fixture({ id: 'cze-zaf', homeTeam: 'Czech Republic', awayTeam: 'South Africa', homeScore: 1, awayScore: 1 }),
        fixture({ id: 'future', status: 'upcoming', homeTeam: 'Mexico', awayTeam: 'Czech Republic', homeScore: null, awayScore: null }),
      ],
    )

    const groupA = tables.find((table) => table.group === 'A')

    expect(groupA?.standings.map((standing) => standing.teamName)).toEqual([
      'Mexico',
      'Czech Republic',
      'South Africa',
      'South Korea',
    ])
    expect(groupA?.standings[0]).toMatchObject({
      ownerName: 'Solomon',
      ownerNeutralPhotoUrl: '/api/participants/slot-mexico/images/neutral',
      played: 1,
      won: 1,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDifference: 1,
      points: 3,
      form: ['win', 'empty', 'empty', 'empty', 'empty'],
    })
    expect(groupA?.standings[1]).toMatchObject({
      played: 1,
      drawn: 1,
      points: 1,
      form: ['draw', 'empty', 'empty', 'empty', 'empty'],
    })
  })

  test('keeps unassigned teams visible with placeholder owner state', () => {
    const [groupA] = buildGroupTables([team('South Africa')], makeDraw(), [])

    expect(groupA.standings[0]).toMatchObject({
      teamName: 'South Africa',
      ownerName: 'Unassigned',
      isAssigned: false,
      points: 0,
    })
  })
})

describe('leaderboard knockout bracket', () => {
  test('selects knockout fixtures and handles TBD slots', () => {
    const matches = buildBracketMatches(
      [team('Mexico'), team('South Korea')],
      makeDraw(),
      [
        fixture({ id: 'group', round: 'Group A' }),
        fixture({ id: 'matchday', round: 'Matchday 1' }),
        fixture({
          id: 'round-of-32',
          round: 'Round of 32',
          startsAt: '2026-07-09T20:00:00.000Z',
          homeTeam: 'Mexico',
          awayTeam: 'TBD',
          homeScore: null,
          awayScore: null,
          status: 'upcoming',
          statusLabel: 'Scheduled',
        }),
      ],
    )

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      id: 'round-of-32',
      round: 'Round of 32',
      home: {
        teamName: 'Mexico',
        ownerName: 'Solomon',
        isAssigned: true,
      },
      away: {
        teamName: 'TBD',
        ownerName: 'TBD',
        isAssigned: false,
      },
    })
  })
})
