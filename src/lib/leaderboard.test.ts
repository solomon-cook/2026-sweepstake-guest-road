import { describe, expect, test } from 'vitest'
import { toPersistedDraw } from './draw-repository'
import { buildBracketMatches, buildGroupTables, buildLeaderboardData, buildPlayerLeaderboard } from './leaderboard'
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

describe('player leaderboard', () => {
  test('ranks players by alive teams first and alive score second', () => {
    const players = buildPlayerLeaderboard(
      [
        team('Mexico'),
        team('South Africa'),
        team('South Korea'),
        team('Czech Republic'),
        team('Germany'),
        team('Curaçao'),
        team('Ivory Coast'),
        team('Ecuador'),
        team('Netherlands'),
        team('Japan'),
        team('Sweden'),
        team('Tunisia'),
      ],
      toPersistedDraw(7, [
        {
          id: 'slot-alice',
          slotIndex: 0,
          playerName: 'Alice',
          totalScore: 12,
          isRevealed: true,
          teamAssignments: [
            { teamOrder: 0, team: team('Mexico') },
            { teamOrder: 1, team: team('Germany') },
            { teamOrder: 2, team: team('South Korea') },
          ],
        },
        {
          id: 'slot-bob',
          slotIndex: 1,
          playerName: 'Bob',
          totalScore: 11,
          isRevealed: true,
          teamAssignments: [
            { teamOrder: 0, team: team('Czech Republic') },
            { teamOrder: 1, team: team('South Africa') },
            { teamOrder: 2, team: team('Tunisia') },
          ],
        },
        {
          id: 'slot-charlie',
          slotIndex: 2,
          playerName: 'Charlie',
          totalScore: 9,
          isRevealed: true,
          teamAssignments: [
            { teamOrder: 0, team: team('Netherlands') },
            { teamOrder: 1, team: team('Sweden') },
            { teamOrder: 2, team: team('Japan') },
          ],
        },
        {
          id: 'slot-empty',
          slotIndex: 3,
          playerName: '',
          totalScore: 7,
          isRevealed: false,
          teamAssignments: [{ teamOrder: 0, team: team('Ecuador') }],
        },
      ]),
      [
        fixture({ id: 'a1', round: 'Group A', homeTeam: 'Mexico', awayTeam: 'South Korea', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'a2', round: 'Group A', homeTeam: 'Czech Republic', awayTeam: 'South Africa', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'a3', round: 'Group A', homeTeam: 'Mexico', awayTeam: 'Czech Republic', homeScore: 1, awayScore: 1 }),
        fixture({ id: 'a4', round: 'Group A', homeTeam: 'South Africa', awayTeam: 'South Korea', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'a5', round: 'Group A', homeTeam: 'Mexico', awayTeam: 'South Africa', homeScore: 3, awayScore: 1 }),
        fixture({ id: 'a6', round: 'Group A', homeTeam: 'South Korea', awayTeam: 'Czech Republic', homeScore: 0, awayScore: 2 }),
        fixture({ id: 'e1', round: 'Group E', homeTeam: 'Germany', awayTeam: 'Ecuador', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'e2', round: 'Group E', homeTeam: 'Curaçao', awayTeam: 'Ivory Coast', homeScore: 0, awayScore: 1 }),
        fixture({ id: 'e3', round: 'Group E', homeTeam: 'Germany', awayTeam: 'Curaçao', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'e4', round: 'Group E', homeTeam: 'Ecuador', awayTeam: 'Ivory Coast', homeScore: 1, awayScore: 1 }),
        fixture({ id: 'e5', round: 'Group E', homeTeam: 'Germany', awayTeam: 'Ivory Coast', homeScore: 0, awayScore: 0 }),
        fixture({ id: 'e6', round: 'Group E', homeTeam: 'Ecuador', awayTeam: 'Curaçao', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f1', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Japan', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'f2', round: 'Group F', homeTeam: 'Sweden', awayTeam: 'Tunisia', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f3', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Sweden', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f4', round: 'Group F', homeTeam: 'Japan', awayTeam: 'Tunisia', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f5', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Tunisia', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'f6', round: 'Group F', homeTeam: 'Japan', awayTeam: 'Sweden', homeScore: 0, awayScore: 1 }),
        fixture({
          id: 'r32',
          round: 'Round of 32',
          status: 'upcoming',
          statusLabel: 'Scheduled',
          homeTeam: 'Mexico',
          awayTeam: 'Germany',
          homeScore: null,
          awayScore: null,
        }),
      ],
    )

    expect(players.map((player) => player.playerName)).toEqual(['Alice', 'Charlie', 'Bob'])
    expect(players[0]).toMatchObject({
      mood: 'ecstatic',
      aliveTeamCount: 2,
      aliveScoreTotal: Number((team('Mexico').score + team('Germany').score).toFixed(2)),
      bestAliveTeamRank: Math.min(team('Mexico').rank, team('Germany').rank),
    })
    expect(players[1].aliveTeamCount).toBe(2)
    expect(players[1].mood).toBe('ecstatic')
    expect(players[1].aliveScoreTotal).toBeLessThan(players[0].aliveScoreTotal)
    expect(players[2]).toMatchObject({
      mood: 'neutral',
      aliveTeamCount: 1,
      teams: [
        { teamName: 'Czech Republic', isAlive: true },
        { teamName: 'South Africa', isAlive: false },
        { teamName: 'Tunisia', isAlive: false },
      ],
    })
    expect(players[2].aliveScoreTotal).toBe(team('Czech Republic').score)
  })

  test('breaks ties deterministically and carries players through leaderboard data', () => {
    const draw = toPersistedDraw(7, [
      {
        id: 'slot-zoe',
        slotIndex: 0,
        playerName: 'Zoe',
        totalScore: 10,
        isRevealed: true,
        teamAssignments: [{ teamOrder: 0, team: team('Mexico') }],
      },
      {
        id: 'slot-amy',
        slotIndex: 1,
        playerName: 'Amy',
        totalScore: 10,
        isRevealed: true,
        teamAssignments: [{ teamOrder: 0, team: team('Mexico') }],
      },
    ])

    const data = buildLeaderboardData([team('Mexico')], draw, [])

    expect(data.players.map((player) => player.playerName)).toEqual(['Amy', 'Zoe'])
    expect(data.players[0]).toMatchObject({
      mood: 'ecstatic',
      aliveTeamCount: 1,
      aliveScoreTotal: team('Mexico').score,
      bestAliveTeamRank: team('Mexico').rank,
    })
  })

  test('marks players as devastated when all of their teams are out', () => {
    const players = buildPlayerLeaderboard(
      [
        team('Mexico'),
        team('South Africa'),
        team('South Korea'),
        team('Czech Republic'),
        team('Netherlands'),
        team('Japan'),
        team('Sweden'),
        team('Tunisia'),
      ],
      toPersistedDraw(7, [
        {
          id: 'slot-bob',
          slotIndex: 0,
          playerName: 'Bob',
          totalScore: 4,
          isRevealed: true,
          teamAssignments: [
            { teamOrder: 0, team: team('South Africa') },
            { teamOrder: 1, team: team('South Korea') },
            { teamOrder: 2, team: team('Tunisia') },
          ],
        },
      ]),
      [
        fixture({ id: 'a1', round: 'Group A', homeTeam: 'Mexico', awayTeam: 'South Korea', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'a2', round: 'Group A', homeTeam: 'Czech Republic', awayTeam: 'South Africa', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'a3', round: 'Group A', homeTeam: 'Mexico', awayTeam: 'Czech Republic', homeScore: 1, awayScore: 1 }),
        fixture({ id: 'a4', round: 'Group A', homeTeam: 'South Africa', awayTeam: 'South Korea', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'a5', round: 'Group A', homeTeam: 'Mexico', awayTeam: 'South Africa', homeScore: 3, awayScore: 1 }),
        fixture({ id: 'a6', round: 'Group A', homeTeam: 'South Korea', awayTeam: 'Czech Republic', homeScore: 0, awayScore: 2 }),
        fixture({ id: 'f1', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Japan', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'f2', round: 'Group F', homeTeam: 'Sweden', awayTeam: 'Tunisia', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f3', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Sweden', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f4', round: 'Group F', homeTeam: 'Japan', awayTeam: 'Tunisia', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f5', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Tunisia', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'f6', round: 'Group F', homeTeam: 'Japan', awayTeam: 'Sweden', homeScore: 0, awayScore: 1 }),
      ],
    )

    expect(players).toMatchObject([
      {
        playerName: 'Bob',
        mood: 'devastated',
        aliveTeamCount: 0,
      },
    ])
  })
})
