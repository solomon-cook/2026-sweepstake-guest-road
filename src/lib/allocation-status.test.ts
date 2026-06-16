import { describe, expect, test } from 'vitest'
import { buildAllocationDisplayState } from './allocation-status'
import { toPersistedDraw } from './draw-repository'
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
  return toPersistedDraw(7, [
    {
      id: 'slot-alice',
      slotIndex: 0,
      playerName: 'Alice',
      totalScore: 12,
      isRevealed: true,
      teamAssignments: [
        { teamOrder: 0, team: team('Mexico') },
        { teamOrder: 1, team: team('Czech Republic') },
        { teamOrder: 2, team: team('South Africa') },
      ],
    },
    {
      id: 'slot-bob',
      slotIndex: 1,
      playerName: 'Bob',
      totalScore: 9,
      isRevealed: true,
      teamAssignments: [
        { teamOrder: 0, team: team('South Korea') },
        { teamOrder: 1, team: team('Japan') },
      ],
    },
    {
      id: 'slot-charlie',
      slotIndex: 2,
      playerName: 'Charlie',
      totalScore: 11,
      isRevealed: true,
      teamAssignments: [
        { teamOrder: 0, team: team('Germany') },
        { teamOrder: 1, team: team('Ecuador') },
      ],
    },
  ])
}

function fixture(overrides: Partial<MatchFixture>): MatchFixture {
  return {
    id: 'fixture-1',
    startsAt: '2026-06-16T19:00:00.000Z',
    status: 'finished',
    statusLabel: 'FT',
    round: 'Group A',
    homeTeam: 'Mexico',
    awayTeam: 'South Korea',
    homeScore: 2,
    awayScore: 0,
    ...overrides,
  }
}

describe('buildAllocationDisplayState', () => {
  test('orders teams by current success and dims teams that are out', () => {
    const teams = [
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
    ]

    const state = buildAllocationDisplayState(teams, makeDraw(), [
      fixture({ id: 'a1', homeTeam: 'Mexico', awayTeam: 'South Korea', homeScore: 2, awayScore: 0 }),
      fixture({ id: 'a2', homeTeam: 'Czech Republic', awayTeam: 'South Africa', homeScore: 1, awayScore: 0 }),
      fixture({ id: 'a3', homeTeam: 'Mexico', awayTeam: 'Czech Republic', homeScore: 1, awayScore: 1 }),
      fixture({ id: 'a4', homeTeam: 'South Africa', awayTeam: 'South Korea', homeScore: 1, awayScore: 0 }),
      fixture({ id: 'a5', homeTeam: 'Mexico', awayTeam: 'South Africa', homeScore: 3, awayScore: 1 }),
      fixture({ id: 'a6', homeTeam: 'South Korea', awayTeam: 'Czech Republic', homeScore: 0, awayScore: 2 }),
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
        awayTeam: 'TBD',
        homeScore: null,
        awayScore: null,
      }),
    ])

    expect(state.teamsByName.mexico.sortOrder).toBeGreaterThan(state.teamsByName.czechrepublic.sortOrder)
    expect(state.teamsByName.czechrepublic.sortOrder).toBeGreaterThan(state.teamsByName.southafrica.sortOrder)
    expect(state.teamsByName.southafrica.isDimmed).toBe(true)
    expect(state.teamsByName.southkorea.isDimmed).toBe(true)
    expect(state.teamsByName.germany.isAlive).toBe(true)
    expect(state.teamsByName.ecuador.isDimmed).toBe(true)
  })

  test('chooses participant mood from how many teams are still alive', () => {
    const teams = [
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
    ]

    const state = buildAllocationDisplayState(teams, makeDraw(), [
      fixture({ id: 'a1', homeTeam: 'Mexico', awayTeam: 'South Korea', homeScore: 2, awayScore: 0 }),
      fixture({ id: 'a2', homeTeam: 'Czech Republic', awayTeam: 'South Africa', homeScore: 1, awayScore: 0 }),
      fixture({ id: 'a3', homeTeam: 'Mexico', awayTeam: 'Czech Republic', homeScore: 1, awayScore: 1 }),
      fixture({ id: 'a4', homeTeam: 'South Africa', awayTeam: 'South Korea', homeScore: 1, awayScore: 0 }),
      fixture({ id: 'a5', homeTeam: 'Mexico', awayTeam: 'South Africa', homeScore: 3, awayScore: 1 }),
      fixture({ id: 'a6', homeTeam: 'South Korea', awayTeam: 'Czech Republic', homeScore: 0, awayScore: 2 }),
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
        awayTeam: 'TBD',
        homeScore: null,
        awayScore: null,
      }),
    ])

    expect(state.bundleMoodBySlotId).toMatchObject({
      'slot-alice': 'ecstatic',
      'slot-bob': 'devastated',
      'slot-charlie': 'neutral',
    })
  })
})
