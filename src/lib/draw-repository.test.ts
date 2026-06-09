import { describe, expect, test } from 'vitest'
import { calculateMetrics, toPersistedDraw } from './draw-repository'
import { TEAM_SEED_SCORES } from './team-source'

describe('draw repository helpers', () => {
  test('maps persisted slots into stable revealed bundles', () => {
    const [firstTeam, secondTeam] = TEAM_SEED_SCORES
    const draw = toPersistedDraw(7, [
      {
        id: 'slot-2',
        slotIndex: 1,
        playerName: 'Player 2',
        totalScore: 8.5,
        isRevealed: true,
        teamAssignments: [
          { teamOrder: 1, team: secondTeam },
          { teamOrder: 0, team: firstTeam },
        ],
      },
      {
        id: 'slot-1',
        slotIndex: 0,
        playerName: 'Player 1',
        totalScore: 5.25,
        isRevealed: false,
        teamAssignments: [{ teamOrder: 0, team: secondTeam }],
      },
    ])

    expect(draw.allocation.bundles[0]).toMatchObject({
      slotId: 'slot-1',
      slotIndex: 0,
      playerName: 'Player 1',
      isRevealed: false,
    })
    expect(draw.allocation.bundles[1]).toMatchObject({
      slotId: 'slot-2',
      slotIndex: 1,
      playerName: 'Player 2',
      isRevealed: true,
    })
    expect(draw.allocation.bundles[1].teams.map((team) => team.name)).toEqual([
      firstTeam.name,
      secondTeam.name,
    ])
  })

  test('calculates fairness metrics from revealed bundle shape', () => {
    const metrics = calculateMetrics([
      {
        slotId: 'slot-1',
        slotIndex: 0,
        playerName: 'Player 1',
        teams: [TEAM_SEED_SCORES[0]],
        totalScore: 14,
        isRevealed: false,
      },
      {
        slotId: 'slot-2',
        slotIndex: 1,
        playerName: 'Player 2',
        teams: [TEAM_SEED_SCORES[1], TEAM_SEED_SCORES[2]],
        totalScore: 12,
        isRevealed: true,
      },
    ])

    expect(metrics.averageScore).toBe(13)
    expect(metrics.scoreSpread).toBe(2)
    expect(metrics.teamCountSpread).toBe(1)
    expect(metrics.balanceLabel).toBe('Loose')
  })
})
