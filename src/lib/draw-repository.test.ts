import { describe, expect, test } from 'vitest'
import { calculateMetrics, toPersistedDraw } from './draw-repository'
import { TEAM_SEED_SCORES } from './team-source'

describe('draw repository helpers', () => {
  test('maps persisted slots into stable revealed bundles', () => {
    const [firstSeedTeam, secondSeedTeam] = TEAM_SEED_SCORES
    const firstTeam = {
      ...firstSeedTeam,
      id: 'team-1',
      flagImageBytes: Buffer.from('first-flag'),
      flagImageMimeType: 'image/png',
    }
    const secondTeam = { ...secondSeedTeam, id: 'team-2' }
    const draw = toPersistedDraw(7, [
      {
        id: 'slot-2',
        slotIndex: 1,
        playerName: 'Player 2',
        photoMimeType: 'image/jpeg',
        photoData: Buffer.from('source'),
        generatedImageMimeType: 'image/jpeg',
        neutralImageData: Buffer.from('neutral'),
        ecstaticImageData: Buffer.from('ecstatic'),
        devastatedImageData: Buffer.from('devastated'),
        fanImageStatus: 'ready',
        fanImageTeamId: 'team-1',
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
      sourcePhotoUrl: '/api/participants/slot-2/images/source',
      fanImageStatus: 'ready',
      fanImageTeamName: firstTeam.name,
    })
    expect(draw.allocation.bundles[1].teams.map((team) => team.name)).toEqual([
      firstTeam.name,
      secondTeam.name,
    ])
    expect(draw.allocation.bundles[1].teams[0].flagImageUrl).toBe('/api/team-flags/team-1')
    expect(draw.allocation.bundles[1].teams[1].flagImageUrl).toBe('/api/team-flags/team-2')
    expect(draw.allocation.bundles[1].teams[0]).not.toHaveProperty('flagImageBytes')
    expect(draw.allocation.bundles[1].teams[0]).not.toHaveProperty('flagImageMimeType')
    expect(draw.allocation.bundles[1].fanImageUrls).toEqual({
      neutral: '/api/participants/slot-2/images/neutral',
      ecstatic: '/api/participants/slot-2/images/ecstatic',
      devastated: '/api/participants/slot-2/images/devastated',
    })
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
        fanImageStatus: 'idle',
      },
      {
        slotId: 'slot-2',
        slotIndex: 1,
        playerName: 'Player 2',
        teams: [TEAM_SEED_SCORES[1], TEAM_SEED_SCORES[2]],
        totalScore: 12,
        isRevealed: true,
        fanImageStatus: 'idle',
      },
    ])

    expect(metrics.averageScore).toBe(13)
    expect(metrics.scoreSpread).toBe(2)
    expect(metrics.teamCountSpread).toBe(1)
    expect(metrics.balanceLabel).toBe('Loose')
  })
})
