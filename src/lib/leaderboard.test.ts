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
  test('calculates standings and last-three form from scored group fixtures', () => {
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
      form: ['win', 'empty', 'empty'],
    })
    expect(groupA?.standings[1]).toMatchObject({
      played: 1,
      drawn: 1,
      points: 1,
      form: ['draw', 'empty', 'empty'],
    })
  })

  test('ignores upcoming group fixtures with placeholder zero-zero scores', () => {
    const tables = buildGroupTables(
      [team('Mexico'), team('South Korea')],
      makeDraw(),
      [
        fixture({
          id: 'placeholder',
          status: 'upcoming',
          statusLabel: 'Scheduled',
          homeTeam: 'Mexico',
          awayTeam: 'South Korea',
          homeScore: 0,
          awayScore: 0,
        }),
      ],
    )

    const groupA = tables.find((table) => table.group === 'A')

    expect(groupA?.standings).toMatchObject([
      {
        teamName: 'Mexico',
        played: 0,
        drawn: 0,
        points: 0,
        form: ['empty', 'empty', 'empty'],
      },
      {
        teamName: 'South Korea',
        played: 0,
        drawn: 0,
        points: 0,
        form: ['empty', 'empty', 'empty'],
      },
    ])
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

  test('treats resolved cross-group fixtures without round labels as knockout matches', () => {
    const matches = buildBracketMatches(
      [team('Sweden'), team('Mexico')],
      makeDraw(),
      [
        fixture({
          id: 'espn-sweden-mexico',
          round: null,
          status: 'upcoming',
          statusLabel: 'Scheduled',
          homeTeam: 'Sweden',
          awayTeam: 'Mexico',
          homeScore: null,
          awayScore: null,
        }),
      ],
    )

    expect(matches).toMatchObject([
      {
        id: 'espn-sweden-mexico',
        round: 'Knockout',
        home: { teamName: 'Sweden' },
        away: { teamName: 'Mexico' },
      },
    ])
  })

  test('orders knockout matches by next-round winner references', () => {
    const matches = buildBracketMatches(
      [],
      makeDraw(),
      [
        fixture({
          id: 'r16-90',
          round: 'Round of 16',
          knockoutOrder: 90,
          startsAt: '2026-07-04T17:00:00.000Z',
          homeTeam: 'Canada',
          awayTeam: 'Morocco',
        }),
        fixture({
          id: 'r16-89',
          round: 'Round of 16',
          knockoutOrder: 89,
          startsAt: '2026-07-04T21:00:00.000Z',
          homeTeam: 'Paraguay',
          awayTeam: 'France',
        }),
        fixture({
          id: 'r16-91',
          round: 'Round of 16',
          knockoutOrder: 91,
          startsAt: '2026-07-05T20:00:00.000Z',
          homeTeam: 'Brazil',
          awayTeam: 'Norway',
        }),
        fixture({
          id: 'r16-92',
          round: 'Round of 16',
          knockoutOrder: 92,
          startsAt: '2026-07-06T00:00:00.000Z',
          homeTeam: 'Mexico',
          awayTeam: 'England',
        }),
        fixture({
          id: 'espn-93',
          round: 'Round of 16',
          knockoutOrder: 93,
          startsAt: '2026-07-06T19:00:00.000Z',
          homeTeam: 'Portugal',
          awayTeam: 'Spain',
        }),
        fixture({
          id: 'espn-94',
          round: 'Round of 16',
          knockoutOrder: 94,
          startsAt: '2026-07-07T00:00:00.000Z',
          homeTeam: 'United States',
          awayTeam: 'Belgium',
        }),
        fixture({
          id: 'r16-95',
          round: 'Round of 16',
          knockoutOrder: 95,
          startsAt: '2026-07-07T16:00:00.000Z',
          homeTeam: 'Argentina',
          awayTeam: 'Egypt',
        }),
        fixture({
          id: 'r16-96',
          round: 'Round of 16',
          knockoutOrder: 96,
          startsAt: '2026-07-07T20:00:00.000Z',
          homeTeam: 'Switzerland',
          awayTeam: 'Colombia',
        }),
        fixture({
          id: 'qf-97',
          round: 'Quarter-finals',
          knockoutOrder: 97,
          homeTeam: 'W89',
          awayTeam: 'W90',
        }),
        fixture({
          id: 'qf-98',
          round: 'Quarter-finals',
          knockoutOrder: 98,
          homeTeam: 'W93',
          awayTeam: 'W94',
        }),
        fixture({
          id: 'qf-99',
          round: 'Quarter-finals',
          knockoutOrder: 99,
          homeTeam: 'W91',
          awayTeam: 'W92',
        }),
        fixture({
          id: 'qf-100',
          round: 'Quarter-finals',
          knockoutOrder: 100,
          homeTeam: 'W95',
          awayTeam: 'W96',
        }),
      ],
    )

    expect(matches.filter((match) => match.round === 'Round of 16').map((match) => match.id)).toEqual([
      'r16-89',
      'r16-90',
      'espn-93',
      'espn-94',
      'r16-91',
      'r16-92',
      'r16-95',
      'r16-96',
    ])
  })
})

describe('player leaderboard', () => {
  test('treats current top-two teams as through while unfinished groups keep others pending', () => {
    const players = buildPlayerLeaderboard(
      [team('Mexico'), team('South Korea'), team('Czech Republic'), team('South Africa')],
      toPersistedDraw(7, [
        {
          id: 'slot-alice',
          slotIndex: 0,
          playerName: 'Alice',
          totalScore: 10,
          isRevealed: true,
          teamAssignments: [
            { teamOrder: 0, team: team('Mexico') },
            { teamOrder: 1, team: team('South Korea') },
            { teamOrder: 2, team: team('Czech Republic') },
          ],
        },
      ]),
      [
        fixture({ id: 'a1', round: 'Group A', homeTeam: 'Mexico', awayTeam: 'South Korea', homeScore: 2, awayScore: 0 }),
        fixture({
          id: 'a2',
          round: 'Group A',
          status: 'upcoming',
          statusLabel: 'Scheduled',
          homeTeam: 'Czech Republic',
          awayTeam: 'South Africa',
          homeScore: null,
          awayScore: null,
        }),
      ],
    )

    expect(players).toMatchObject([
      {
        playerName: 'Alice',
        mood: 'ecstatic',
        aliveTeamCount: 2,
        eliminatedTeamCount: 0,
        totalTeamCount: 3,
        teams: [
          { teamName: 'Mexico', status: 'alive' },
          { teamName: 'Czech Republic', status: 'alive' },
          { teamName: 'South Korea', status: 'pending' },
        ],
      },
    ])
    expect(players[0].aliveTeamCount + players[0].eliminatedTeamCount).toBeLessThan(players[0].totalTeamCount)
  })

  test('keeps third-place teams alive when they have an upcoming knockout fixture without round metadata', () => {
    const players = buildPlayerLeaderboard(
      [team('Netherlands'), team('Japan'), team('Sweden'), team('Tunisia'), team('Mexico')],
      toPersistedDraw(7, [
        {
          id: 'slot-sweden',
          slotIndex: 0,
          playerName: 'Alice',
          totalScore: 10,
          isRevealed: true,
          teamAssignments: [{ teamOrder: 0, team: team('Sweden') }],
        },
      ]),
      [
        fixture({ id: 'f1', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Sweden', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'f2', round: 'Group F', homeTeam: 'Japan', awayTeam: 'Tunisia', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f3', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Japan', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f4', round: 'Group F', homeTeam: 'Sweden', awayTeam: 'Tunisia', homeScore: 1, awayScore: 0 }),
        fixture({ id: 'f5', round: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Tunisia', homeScore: 2, awayScore: 0 }),
        fixture({ id: 'f6', round: 'Group F', homeTeam: 'Japan', awayTeam: 'Sweden', homeScore: 1, awayScore: 0 }),
        fixture({
          id: 'espn-sweden-mexico',
          startsAt: '2026-06-30T19:00:00.000Z',
          round: null,
          status: 'upcoming',
          statusLabel: 'Scheduled',
          homeTeam: 'Sweden',
          awayTeam: 'Mexico',
          homeScore: null,
          awayScore: null,
        }),
      ],
    )

    expect(players).toMatchObject([
      {
        playerName: 'Alice',
        mood: 'ecstatic',
        aliveTeamCount: 1,
        eliminatedTeamCount: 0,
        teams: [{ teamName: 'Sweden', status: 'alive' }],
      },
    ])
  })

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
        { teamName: 'Czech Republic', status: 'alive' },
        { teamName: 'South Africa', status: 'out' },
        { teamName: 'Tunisia', status: 'out' },
      ],
    })
    expect(players[2].aliveScoreTotal).toBe(team('Czech Republic').score)
  })

  test('uses penalty winner flags to resolve tied knockout matches', () => {
    const players = buildPlayerLeaderboard(
      [team('Germany'), team('Paraguay')],
      toPersistedDraw(7, [
        {
          id: 'slot-germany',
          slotIndex: 0,
          playerName: 'Alice',
          totalScore: 8,
          isRevealed: true,
          teamAssignments: [{ teamOrder: 0, team: team('Germany') }],
        },
        {
          id: 'slot-paraguay',
          slotIndex: 1,
          playerName: 'Bob',
          totalScore: 7,
          isRevealed: true,
          teamAssignments: [{ teamOrder: 0, team: team('Paraguay') }],
        },
      ]),
      [
        fixture({
          id: 'r32-germany-paraguay',
          round: 'Round of 32',
          status: 'finished',
          statusLabel: 'FT-Pens',
          homeTeam: 'Germany',
          awayTeam: 'Paraguay',
          homeScore: 1,
          awayScore: 1,
          homeWinner: false,
          awayWinner: true,
        }),
      ],
    )

    expect(players).toMatchObject([
      {
        playerName: 'Bob',
        aliveTeamCount: 1,
        eliminatedTeamCount: 0,
        teams: [{ teamName: 'Paraguay', status: 'alive' }],
      },
      {
        playerName: 'Alice',
        aliveTeamCount: 0,
        eliminatedTeamCount: 1,
        teams: [{ teamName: 'Germany', status: 'out' }],
      },
    ])
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

    const data = buildLeaderboardData(
      [team('Mexico')],
      draw,
      [
        fixture({
          id: 'r32-mex',
          round: 'Round of 32',
          status: 'upcoming',
          statusLabel: 'Scheduled',
          homeTeam: 'Mexico',
          awayTeam: 'TBD',
          homeScore: null,
          awayScore: null,
        }),
      ],
    )

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
