import { describe, expect, test } from 'vitest'
import { generateBalancedAllocation } from './lib/allocator'
import { TEAM_SEED_SCORES } from './lib/team-source'

describe('team score data', () => {
  test('contains the full 48-team field exactly once', () => {
    expect(TEAM_SEED_SCORES).toHaveLength(48)
    expect(new Set(TEAM_SEED_SCORES.map((team) => team.name)).size).toBe(48)
  })

  test('normalizes team scores to the 100-point pool within rounding tolerance', () => {
    const total = TEAM_SEED_SCORES.reduce((sum, team) => sum + team.score, 0)
    expect(total).toBeGreaterThan(99.7)
    expect(total).toBeLessThan(100.3)
  })

  test('orders teams consistently by score and rank', () => {
    expect(TEAM_SEED_SCORES[0].name).toBe('France')
    expect(TEAM_SEED_SCORES[1].name).toBe('Spain')
    expect(TEAM_SEED_SCORES[0].rank).toBe(1)
    expect(TEAM_SEED_SCORES[TEAM_SEED_SCORES.length - 1].rank).toBe(48)
  })
})

describe('balanced allocation', () => {
  const names = [
    'Sam Felton',
    'Sam Robinson',
    'Dan Blackford',
    'Dan Tarrant',
    'Solomon Cook',
    'Navid Lorchi',
    'Callum Fisher',
    '',
    '',
  ]

  test.each([
    [7, [6, 7]],
    [8, [6]],
    [9, [5, 6]],
  ] as const)('assigns all teams once for %i players', (playerCount, expectedCounts) => {
    const result = generateBalancedAllocation(TEAM_SEED_SCORES, names, playerCount)
    const assignedTeams = result.bundles.flatMap((bundle) => bundle.teams.map((team) => team.name))
    const uniqueCounts = new Set(result.bundles.map((bundle) => bundle.teams.length))

    expect(assignedTeams).toHaveLength(48)
    expect(new Set(assignedTeams).size).toBe(48)
    expect(uniqueCounts).toEqual(new Set(expectedCounts))
  })

  test('keeps the score spread tight for the 7-player version', () => {
    const result = generateBalancedAllocation(TEAM_SEED_SCORES, names, 7)

    expect(result.scoreSpread).toBeLessThan(2.1)
    expect(result.percentDeviation).toBeLessThan(7.5)
  })

  test('falls back to Player n for blank names', () => {
    const result = generateBalancedAllocation(TEAM_SEED_SCORES, names, 9)
    expect(result.bundles.at(-1)?.playerName).toBe('Player 9')
  })

  test('can produce multiple valid rerolls over repeated runs', { timeout: 15000 }, () => {
    const signatures = new Set<string>()

    for (let index = 0; index < 4; index += 1) {
      const result = generateBalancedAllocation(TEAM_SEED_SCORES, names, 7)
      const signature = result.bundles
        .map((bundle) => bundle.teams.map((team) => team.name).join('|'))
        .join('::')

      signatures.add(signature)
    }

    expect(signatures.size).toBeGreaterThan(1)
  })
})
