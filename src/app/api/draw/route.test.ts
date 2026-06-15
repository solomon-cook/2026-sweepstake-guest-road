import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PATCH } from './route'

const routeMocks = vi.hoisted(() => ({
  claimNextDrawSlot: vi.fn(),
  clearDrawPlayers: vi.fn(),
  generateParticipantFanImages: vi.fn(),
  getOrCreateDraw: vi.fn(),
  loadTeamScores: vi.fn(),
  resetDrawRevealState: vi.fn(),
  revealDrawSlot: vi.fn(),
  shuffleDraw: vi.fn(),
  updateDrawNames: vi.fn(),
}))

vi.mock('@/lib/draw-repository', () => ({
  claimNextDrawSlot: routeMocks.claimNextDrawSlot,
  clearDrawPlayers: routeMocks.clearDrawPlayers,
  getOrCreateDraw: routeMocks.getOrCreateDraw,
  resetDrawRevealState: routeMocks.resetDrawRevealState,
  revealDrawSlot: routeMocks.revealDrawSlot,
  shuffleDraw: routeMocks.shuffleDraw,
  updateDrawNames: routeMocks.updateDrawNames,
}))

vi.mock('@/lib/fan-image-generator', () => ({
  generateParticipantFanImages: routeMocks.generateParticipantFanImages,
}))

vi.mock('@/lib/player-count', () => ({
  parsePlayerCount: (value: number) => (value === 7 || value === 8 || value === 9 ? value : null),
}))

vi.mock('@/lib/team-repository', () => ({
  loadTeamScores: routeMocks.loadTeamScores,
}))

const team = {
  id: 'team-france',
  name: 'France',
  flag: '',
  flagCode: 'FRA',
  group: 'A',
  odds: 400,
  impliedProbability: 0.2,
  score: 9,
  rank: 2,
}

function makeDraw(overrides = {}) {
  return {
    playerCount: 7,
    allocation: {
      averageScore: 9,
      scoreSpread: 0,
      teamCountSpread: 0,
      percentDeviation: 0,
      balanceLabel: 'Very Balanced' as const,
      bundles: [
        {
          slotId: 'slot-1',
          slotIndex: 0,
          playerName: 'Alex',
          teams: [team],
          totalScore: 9,
          isRevealed: true,
          sourcePhotoUrl: null,
          fanImageStatus: 'idle' as const,
          fanImageError: null,
          fanImageTeamName: null,
          fanImageUrls: null,
          ...overrides,
        },
      ],
    },
  }
}

function revealRequest() {
  return new Request('http://localhost/api/draw', {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'reveal-slot',
      playerCount: 7,
      slotId: 'slot-1',
    }),
  })
}

describe('draw reveal fan image generation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    routeMocks.claimNextDrawSlot.mockReset()
    routeMocks.clearDrawPlayers.mockReset()
    routeMocks.generateParticipantFanImages.mockReset()
    routeMocks.getOrCreateDraw.mockReset()
    routeMocks.loadTeamScores.mockReset()
    routeMocks.resetDrawRevealState.mockReset()
    routeMocks.revealDrawSlot.mockReset()
    routeMocks.shuffleDraw.mockReset()
    routeMocks.updateDrawNames.mockReset()
    routeMocks.loadTeamScores.mockResolvedValue({ status: 'ready', teams: [team] })
  })

  test('does not call OpenAI when the revealed slot has no source photo', async () => {
    const revealedDraw = makeDraw()
    routeMocks.revealDrawSlot.mockResolvedValue(revealedDraw)

    const response = await PATCH(revealRequest())
    const body = await response.json()

    expect(routeMocks.generateParticipantFanImages).not.toHaveBeenCalled()
    expect(routeMocks.getOrCreateDraw).not.toHaveBeenCalled()
    expect(body).toEqual(revealedDraw)
  })

  test('attempts OpenAI generation after revealing a slot with a source photo', async () => {
    const revealedDraw = makeDraw({ sourcePhotoUrl: '/api/participants/slot-1/images/source' })
    const refreshedDraw = makeDraw({
      sourcePhotoUrl: '/api/participants/slot-1/images/source',
      fanImageStatus: 'ready' as const,
      fanImageUrls: {
        neutral: '/api/participants/slot-1/images/neutral',
        ecstatic: '/api/participants/slot-1/images/ecstatic',
        devastated: '/api/participants/slot-1/images/devastated',
      },
    })
    routeMocks.revealDrawSlot.mockResolvedValue(revealedDraw)
    routeMocks.generateParticipantFanImages.mockResolvedValue({})
    routeMocks.getOrCreateDraw.mockResolvedValue(refreshedDraw)

    const response = await PATCH(revealRequest())
    const body = await response.json()

    expect(routeMocks.generateParticipantFanImages).toHaveBeenCalledWith('slot-1', { force: true })
    expect(body).toEqual(refreshedDraw)
    expect(body.allocation.bundles[0].teams).toEqual(revealedDraw.allocation.bundles[0].teams)
  })

  test('returns the refreshed failed image status when OpenAI generation fails after reveal', async () => {
    const revealedDraw = makeDraw({ sourcePhotoUrl: '/api/participants/slot-1/images/source' })
    const refreshedDraw = makeDraw({
      sourcePhotoUrl: '/api/participants/slot-1/images/source',
      fanImageStatus: 'failed' as const,
      fanImageError: 'Bad image request.',
    })
    routeMocks.revealDrawSlot.mockResolvedValue(revealedDraw)
    routeMocks.generateParticipantFanImages.mockRejectedValue(new Error('Bad image request.'))
    routeMocks.getOrCreateDraw.mockResolvedValue(refreshedDraw)

    const response = await PATCH(revealRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(routeMocks.generateParticipantFanImages).toHaveBeenCalledWith('slot-1', { force: true })
    expect(body.allocation.bundles[0]).toMatchObject({
      isRevealed: true,
      fanImageStatus: 'failed',
      fanImageError: 'Bad image request.',
    })
  })
})
