import sharp from 'sharp'
import convertHeic from 'heic-convert'
import {
  loadParticipantImageSlot,
  markParticipantFanImagesFailed,
  markParticipantFanImagesPending,
  MAX_PARTICIPANT_PHOTO_BYTES,
  saveParticipantFanImages,
  selectTopRatedTeam,
} from './participant-image-repository'

const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/edits'
const OPENAI_IMAGE_MODEL = 'gpt-image-1'
const GENERATED_IMAGE_MIME_TYPE = 'image/jpeg'
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif'])

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

export function isHeicParticipantPhoto(input: { mimeType: string; fileName?: string }) {
  const normalizedFileName = input.fileName?.toLowerCase() ?? ''

  return (
    HEIC_MIME_TYPES.has(input.mimeType) ||
    normalizedFileName.endsWith('.heic') ||
    normalizedFileName.endsWith('.heif')
  )
}

async function toSharpInputBytes(
  fileBytes: Uint8Array<ArrayBufferLike>,
  input: { mimeType?: string; fileName?: string } = {},
) {
  if (!isHeicParticipantPhoto({ mimeType: input.mimeType ?? '', fileName: input.fileName })) {
    return fileBytes
  }

  const sourceBuffer = Buffer.from(fileBytes)
  const converted = await convertHeic({
    buffer: sourceBuffer.buffer.slice(
      sourceBuffer.byteOffset,
      sourceBuffer.byteOffset + sourceBuffer.byteLength,
    ),
    format: 'JPEG',
    quality: 0.9,
  })

  return new Uint8Array(converted)
}

export async function normalizeParticipantPhoto(
  fileBytes: Uint8Array<ArrayBufferLike>,
  input: { mimeType?: string; fileName?: string } = {},
) {
  const sharpInput = await toSharpInputBytes(fileBytes, input)
  const normalized = await sharp(sharpInput)
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
  expression: Expression,
  prompt: string,
  source: { mimeType: string; bytes: Uint8Array<ArrayBufferLike> },
  fetchImpl: FetchLike,
) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const formData = new FormData()
  formData.set('model', OPENAI_IMAGE_MODEL)
  formData.set('prompt', prompt)
  formData.set('size', '1024x1024')
  formData.set('quality', 'medium')
  formData.set('output_format', 'jpeg')
  formData.set('output_compression', '70')
  formData.set('image[]', new Blob([Buffer.from(source.bytes)], { type: source.mimeType }), `${slotId}.jpg`)

  console.info('Requesting OpenAI fan image edit.', {
    slotId,
    expression,
    model: OPENAI_IMAGE_MODEL,
    sourceByteLength: source.bytes.byteLength,
  })

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

  console.info('Received OpenAI fan image edit response.', {
    slotId,
    expression,
    model: OPENAI_IMAGE_MODEL,
    status: response.status,
    ok: response.ok,
  })

  if (!response.ok) {
    const message =
      payload && 'error' in payload
        ? payload.error?.message || 'OpenAI image edit failed.'
        : 'OpenAI image edit failed.'
    console.error('OpenAI fan image edit failed.', {
      slotId,
      expression,
      model: OPENAI_IMAGE_MODEL,
      status: response.status,
      message,
    })
    throw new Error(message)
  }

  const base64 = 'data' in payload ? payload.data?.[0]?.b64_json : null

  if (!base64) {
    console.error('OpenAI fan image edit returned no image.', {
      slotId,
      expression,
      model: OPENAI_IMAGE_MODEL,
      status: response.status,
    })
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

    const neutral = await requestFanImageVariant(
      slotId,
      'neutral',
      buildFanImagePrompt({
        playerName: slot.playerName,
        teamName: topTeam.name,
        expression: 'neutral',
      }),
      source,
      fetchImpl,
    )
    const ecstatic = await requestFanImageVariant(
      slotId,
      'ecstatic',
      buildFanImagePrompt({
        playerName: slot.playerName,
        teamName: topTeam.name,
        expression: 'ecstatic',
      }),
      source,
      fetchImpl,
    )
    const devastated = await requestFanImageVariant(
      slotId,
      'devastated',
      buildFanImagePrompt({
        playerName: slot.playerName,
        teamName: topTeam.name,
        expression: 'devastated',
      }),
      source,
      fetchImpl,
    )

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
