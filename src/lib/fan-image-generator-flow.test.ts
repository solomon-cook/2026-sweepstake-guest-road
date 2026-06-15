import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

const repositoryMocks = vi.hoisted(() => ({
  loadParticipantImageSlot: vi.fn(),
  markParticipantFanImagesFailed: vi.fn(),
  markParticipantFanImagesPending: vi.fn(),
  saveParticipantFanImages: vi.fn(),
  selectTopRatedTeam: vi.fn(),
}))

vi.mock('./participant-image-repository', () => ({
  MAX_PARTICIPANT_PHOTO_BYTES: 2 * 1024 * 1024,
  loadParticipantImageSlot: repositoryMocks.loadParticipantImageSlot,
  markParticipantFanImagesFailed: repositoryMocks.markParticipantFanImagesFailed,
  markParticipantFanImagesPending: repositoryMocks.markParticipantFanImagesPending,
  saveParticipantFanImages: repositoryMocks.saveParticipantFanImages,
  selectTopRatedTeam: repositoryMocks.selectTopRatedTeam,
}))

const originalOpenAiApiKey = process.env.OPENAI_API_KEY

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

function makeSlot(overrides = {}) {
  return {
    id: 'slot-1',
    playerName: 'Alex',
    photoMimeType: 'image/jpeg',
    photoData: new Uint8Array(Buffer.from('source-photo')),
    generatedImageMimeType: null,
    neutralImageData: null,
    ecstaticImageData: null,
    devastatedImageData: null,
    fanImageStatus: 'idle' as const,
    fanImageError: null,
    fanImageTeamId: null,
    isRevealed: true,
    teamAssignments: [{ teamOrder: 0, team }],
    ...overrides,
  }
}

function imageResponse(label: string) {
  return new Response(
    JSON.stringify({
      data: [{ b64_json: Buffer.from(label).toString('base64') }],
    }),
    { status: 200 },
  )
}

describe('participant fan image generation flow', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    vi.restoreAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    repositoryMocks.loadParticipantImageSlot.mockReset()
    repositoryMocks.markParticipantFanImagesFailed.mockReset()
    repositoryMocks.markParticipantFanImagesPending.mockReset()
    repositoryMocks.saveParticipantFanImages.mockReset()
    repositoryMocks.selectTopRatedTeam.mockReset()
    repositoryMocks.selectTopRatedTeam.mockReturnValue(team)
  })

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey
  })

  test('calls OpenAI once for each fan image expression when the revealed slot has a source photo', async () => {
    const { generateParticipantFanImages } = await import('./fan-image-generator')
    const slot = makeSlot()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(imageResponse('neutral'))
      .mockResolvedValueOnce(imageResponse('ecstatic'))
      .mockResolvedValueOnce(imageResponse('devastated'))

    repositoryMocks.loadParticipantImageSlot.mockResolvedValue(slot)

    await generateParticipantFanImages(slot.id, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(repositoryMocks.markParticipantFanImagesPending).toHaveBeenCalledWith(slot.id, team.id)

    const prompts = fetchImpl.mock.calls.map(([, request]) => (request?.body as FormData).get('prompt'))
    expect(prompts).toEqual([
      expect.stringContaining('neutral expression'),
      expect.stringContaining('ecstatic celebration'),
      expect.stringContaining('devastated expression'),
    ])

    const firstBody = fetchImpl.mock.calls[0][1]?.body as FormData
    expect(firstBody.get('model')).toBe('gpt-image-2')
    expect(firstBody.get('size')).toBe('1024x1024')
    expect(firstBody.get('output_format')).toBe('jpeg')
    expect(firstBody.get('output_compression')).toBe('70')
    expect(firstBody.get('image[]')).toBeTruthy()
  })

  test('does not call OpenAI for an unrevealed slot', async () => {
    const { generateParticipantFanImages } = await import('./fan-image-generator')
    const slot = makeSlot({ isRevealed: false })
    const fetchImpl = vi.fn()

    repositoryMocks.loadParticipantImageSlot.mockResolvedValue(slot)

    await expect(generateParticipantFanImages(slot.id, { fetchImpl })).rejects.toThrow(
      'Fan images can only be generated after the participant pack is revealed.',
    )

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(repositoryMocks.markParticipantFanImagesPending).not.toHaveBeenCalled()
  })

  test('marks generation as failed with the OpenAI error message', async () => {
    const { generateParticipantFanImages } = await import('./fan-image-generator')
    const slot = makeSlot()
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Bad image request.' } }), {
        status: 400,
      }),
    )

    repositoryMocks.loadParticipantImageSlot.mockResolvedValue(slot)

    await expect(generateParticipantFanImages(slot.id, { fetchImpl })).rejects.toThrow('Bad image request.')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(repositoryMocks.markParticipantFanImagesFailed).toHaveBeenCalledWith(
      slot.id,
      'Bad image request.',
      team.id,
    )
  })

  test('stores generated image bytes and marks the slot ready after successful generation', async () => {
    const { generateParticipantFanImages } = await import('./fan-image-generator')
    const slot = makeSlot()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(imageResponse('neutral'))
      .mockResolvedValueOnce(imageResponse('ecstatic'))
      .mockResolvedValueOnce(imageResponse('devastated'))

    repositoryMocks.loadParticipantImageSlot.mockResolvedValue(slot)

    await generateParticipantFanImages(slot.id, { fetchImpl })

    expect(repositoryMocks.saveParticipantFanImages).toHaveBeenCalledWith(slot.id, {
      generatedImageMimeType: 'image/jpeg',
      teamId: team.id,
      neutral: expect.any(Uint8Array),
      ecstatic: expect.any(Uint8Array),
      devastated: expect.any(Uint8Array),
    })

    const saved = repositoryMocks.saveParticipantFanImages.mock.calls[0][1]
    expect(Buffer.from(saved.neutral).toString()).toBe('neutral')
    expect(Buffer.from(saved.ecstatic).toString()).toBe('ecstatic')
    expect(Buffer.from(saved.devastated).toString()).toBe('devastated')
  })
})
