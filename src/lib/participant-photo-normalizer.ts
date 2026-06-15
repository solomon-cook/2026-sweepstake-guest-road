import sharp from 'sharp'
import { MAX_PARTICIPANT_PHOTO_BYTES } from './participant-image-repository'

const GENERATED_IMAGE_MIME_TYPE = 'image/jpeg'
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])

export function isHeicParticipantPhoto(input: { mimeType: string; fileName?: string }) {
  const normalizedFileName = input.fileName?.toLowerCase() ?? ''

  return (
    HEIC_MIME_TYPES.has(input.mimeType) ||
    normalizedFileName.endsWith('.heic') ||
    normalizedFileName.endsWith('.heif') ||
    normalizedFileName.endsWith('.heics') ||
    normalizedFileName.endsWith('.heifs')
  )
}

export async function normalizeParticipantPhoto(
  fileBytes: Uint8Array<ArrayBufferLike>,
  input: { mimeType?: string; fileName?: string } = {},
) {
  let normalized: Buffer

  try {
    normalized = await sharp(fileBytes)
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
  } catch (error) {
    if (isHeicParticipantPhoto({ mimeType: input.mimeType ?? '', fileName: input.fileName })) {
      console.error('Failed to normalize HEIC participant photo.', {
        mimeType: input.mimeType ?? null,
        fileName: input.fileName ?? null,
        message: error instanceof Error ? error.message : 'Unknown HEIC normalization error.',
      })
      throw new Error('Failed to convert HEIC/HEIF photo. Try exporting it as JPEG or PNG.', { cause: error })
    }

    throw error
  }

  if (normalized.byteLength > MAX_PARTICIPANT_PHOTO_BYTES) {
    throw new Error('Participant photos must be 2MB or smaller after processing.')
  }

  return {
    mimeType: GENERATED_IMAGE_MIME_TYPE,
    bytes: new Uint8Array(normalized),
  }
}
