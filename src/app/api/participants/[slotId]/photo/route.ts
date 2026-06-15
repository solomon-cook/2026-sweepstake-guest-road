import { NextResponse } from 'next/server'
import {
  ALLOWED_PARTICIPANT_IMAGE_MIME_TYPES,
  loadParticipantImageSlot,
  saveParticipantSourcePhoto,
} from '@/lib/participant-image-repository'
import { generateParticipantFanImages, normalizeParticipantPhoto } from '@/lib/fan-image-generator'
import { toParticipantImageResponse } from '@/lib/participant-image-view'

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> },
) {
  try {
    const { slotId } = await context.params
    let fanImageGenerationError: string | null = null
    const slot = await loadParticipantImageSlot(slotId)

    if (!slot) {
      return NextResponse.json({ error: 'Participant slot not found.' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('photo')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Attach a photo file before uploading.' }, { status: 400 })
    }

    if (!ALLOWED_PARTICIPANT_IMAGE_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Participant photos must be JPEG, PNG, or WebP.' }, { status: 400 })
    }

    const normalizedPhoto = await normalizeParticipantPhoto(new Uint8Array(await file.arrayBuffer()))
    await saveParticipantSourcePhoto(slotId, {
      photoMimeType: normalizedPhoto.mimeType,
      photoData: normalizedPhoto.bytes,
    })

    if (slot.isRevealed) {
      try {
        await generateParticipantFanImages(slotId, { force: true })
      } catch (generationError) {
        const message =
          generationError instanceof Error ? generationError.message : 'Failed to generate fan images.'
        fanImageGenerationError = message
        console.error('Participant photo uploaded, but OpenAI fan image generation failed.', {
          slotId,
          message,
        })
      }
    }

    const refreshed = await loadParticipantImageSlot(slotId)
    const response = toParticipantImageResponse(refreshed!)

    return NextResponse.json({
      ...response,
      fanImageError: response.fanImageError ?? fanImageGenerationError,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload participant photo.'
    const status = message.includes('2MB') || message.includes('JPEG, PNG, or WebP') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
