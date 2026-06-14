import { describe, expect, test } from 'vitest'
import { buildFanImagePrompt } from './fan-image-generator'
import { readParticipantImageBytes, selectTopRatedTeam } from './participant-image-repository'

describe('participant fan image helpers', () => {
  test('selects the highest-ranked assigned team without mutating assignments', () => {
    const slot = {
      id: 'slot-1',
      playerName: 'Alex',
      photoMimeType: 'image/jpeg',
      photoData: Buffer.from('photo'),
      generatedImageMimeType: 'image/jpeg',
      neutralImageData: Buffer.from('neutral'),
      ecstaticImageData: Buffer.from('ecstatic'),
      devastatedImageData: Buffer.from('devastated'),
      fanImageStatus: 'ready' as const,
      fanImageError: null,
      fanImageTeamId: 'team-2',
      isRevealed: true,
      teamAssignments: [
        {
          teamOrder: 1,
          team: {
            id: 'team-3',
            name: 'Team 3',
            flag: '',
            flagCode: 'T3',
            group: 'A',
            odds: 500,
            impliedProbability: 0.1,
            score: 8,
            rank: 3,
          },
        },
        {
          teamOrder: 0,
          team: {
            id: 'team-2',
            name: 'Team 2',
            flag: '',
            flagCode: 'T2',
            group: 'A',
            odds: 400,
            impliedProbability: 0.2,
            score: 9,
            rank: 2,
          },
        },
      ],
    }
    const beforeOrder = slot.teamAssignments.map((assignment) => assignment.team.name)

    expect(selectTopRatedTeam(slot)?.name).toBe('Team 2')
    expect(slot.teamAssignments.map((assignment) => assignment.team.name)).toEqual(beforeOrder)
  })

  test('prefers stored generated variants and preserves source fallback bytes', () => {
    const slot = {
      id: 'slot-1',
      playerName: 'Alex',
      photoMimeType: 'image/jpeg',
      photoData: Buffer.from('source'),
      generatedImageMimeType: 'image/jpeg',
      neutralImageData: Buffer.from('neutral'),
      ecstaticImageData: Buffer.from('ecstatic'),
      devastatedImageData: Buffer.from('devastated'),
      fanImageStatus: 'ready' as const,
      fanImageError: null,
      fanImageTeamId: 'team-2',
      isRevealed: true,
      teamAssignments: [],
    }

    expect(Buffer.from(readParticipantImageBytes(slot, 'source')?.bytes ?? []).toString()).toBe('source')
    expect(Buffer.from(readParticipantImageBytes(slot, 'ecstatic')?.bytes ?? []).toString()).toBe('ecstatic')
  })

  test('builds expression-specific prompts that keep the assigned shirt target', () => {
    const prompt = buildFanImagePrompt({
      playerName: 'Alex',
      teamName: 'France',
      expression: 'devastated',
    })

    expect(prompt).toContain('Alex')
    expect(prompt).toContain('France national football shirt')
    expect(prompt).toContain('devastated expression')
  })
})
