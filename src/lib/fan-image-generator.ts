import sharp from 'sharp'
import {
  loadParticipantImageSlot,
  markParticipantFanImagesFailed,
  markParticipantFanImagesPending,
  MAX_PARTICIPANT_PHOTO_BYTES,
  saveParticipantFanImages,
  selectTopRatedTeam,
} from './participant-image-repository'

const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/edits'
const GENERATED_IMAGE_MIME_TYPE = 'image/jpeg'

type Expression = 'ecstatic' | 'neutral' | 'devastated'

type FetchLike = typeof fetch

export function buildFanImagePrompt(input: {
  playerName: string
  teamName: string
  expression: Expression
}) {
  const expressionDirection = {
    ecstatic:
      'ecstatic celebration, huge smile, triumphant body language, intense joy after seeing their team win',
    neutral:
      'neutral expression, calm face, relaxed body language, posed supporter portrait',
    devastated:
      'devastated expression, crushed disappointment, visibly upset body language after seeing their team lose',
  } satisfies Record<Expression, string>

  return [
    `Edit the uploaded photo of ${input.playerName || 'this person'} into a photorealistic football supporter portrait.`,
    `Keep the same person, preserve facial identity, skin tone, hair, and core facial features.`,
    `Dress them in the current ${input.teamName} national football shirt.`,
    `The expression should be ${expressionDirection[input.expression]}.`,
    'Frame as a chest-up portrait, facing camera, realistic stadium lighting, clean background, no text, no watermark, no extra people.',
  ].join(' ')
}

export async function normalizeParticipantPhoto(fileBytes: Uint8Array<ArrayBufferLike>) {
  const normalized = await sharp(fileBytes)
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 84,
      mozjpeg: true,
    })
    .toBuffer()

  if (normalized.byteLength > MAX_PARTICIPANT_PHOTO_BYTES) {
    throw new Error('Participant photos must be 2MB or smaller after processing.')
  }

  return {
    mimeType: GENERATED_IMAGE_MIME_TYPE,
    bytes: new Uint8Array(normalized),
  }
}

async function requestFanImageVariant(
  slotId: string,
  prompt: string,
  source: { mimeType: string; bytes: Uint8Array<ArrayBufferLike> },
  fetchImpl: FetchLike,
) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const formData = new FormData()
  formData.set('model', 'gpt-image-2')
  formData.set('prompt', prompt)
  formData.set('size', '1024x1536')
  formData.set('quality', 'medium')
  formData.set('output_format', 'jpeg')
  formData.set('image[]', new Blob([Buffer.from(source.bytes)], { type: source.mimeType }), `${slotId}.jpg`)

  const response = await fetchImpl(OPENAI_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  const payload = (await response.json()) as
    | { data?: Array<{ b64_json?: string | null }>; error?: { message?: string } }
    | { message?: string }

  if (!response.ok) {
    throw new Error(payload && 'error' in payload ? payload.error?.message || 'OpenAI image edit failed.' : 'OpenAI image edit failed.')
  }

  const base64 = 'data' in payload ? payload.data?.[0]?.b64_json : null

  if (!base64) {
    throw new Error('OpenAI did not return an edited image.')
  }

  return new Uint8Array(Buffer.from(base64, 'base64'))
}

export async function generateParticipantFanImages(
  slotId: string,
  options: { force?: boolean; fetchImpl?: FetchLike } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch
  const slot = await loadParticipantImageSlot(slotId)

  if (!slot) {
    throw new Error('Participant slot not found.')
  }

  if (!slot.photoData || !slot.photoMimeType) {
    throw new Error('Upload a participant photo before generating fan images.')
  }

  if (!slot.isRevealed) {
    throw new Error('Fan images can only be generated after the participant pack is revealed.')
  }

  if (
    !options.force &&
    slot.fanImageStatus === 'ready' &&
    slot.neutralImageData &&
    slot.ecstaticImageData &&
    slot.devastatedImageData
  ) {
    return slot
  }

  const topTeam = selectTopRatedTeam(slot)

  if (!topTeam?.id) {
    throw new Error('No assigned team is available for this participant.')
  }

  await markParticipantFanImagesPending(slotId, topTeam.id)

  try {
    const source = {
      mimeType: slot.photoMimeType,
      bytes: slot.photoData,
    }

    const [neutral, ecstatic, devastated] = await Promise.all([
      requestFanImageVariant(
        slotId,
        buildFanImagePrompt({
          playerName: slot.playerName,
          teamName: topTeam.name,
          expression: 'neutral',
        }),
        source,
        fetchImpl,
      ),
      requestFanImageVariant(
        slotId,
        buildFanImagePrompt({
          playerName: slot.playerName,
          teamName: topTeam.name,
          expression: 'ecstatic',
        }),
        source,
        fetchImpl,
      ),
      requestFanImageVariant(
        slotId,
        buildFanImagePrompt({
          playerName: slot.playerName,
          teamName: topTeam.name,
          expression: 'devastated',
        }),
        source,
        fetchImpl,
      ),
    ])

    await saveParticipantFanImages(slotId, {
      generatedImageMimeType: GENERATED_IMAGE_MIME_TYPE,
      teamId: topTeam.id,
      neutral,
      ecstatic,
      devastated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate fan images.'
    await markParticipantFanImagesFailed(slotId, message, topTeam.id)
    throw error
  }

  return loadParticipantImageSlot(slotId)
}
