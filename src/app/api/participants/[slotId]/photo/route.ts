import { NextResponse } from 'next/server'
import {
  ALLOWED_PARTICIPANT_IMAGE_EXTENSIONS,
  ALLOWED_PARTICIPANT_IMAGE_MIME_TYPES,
  loadParticipantImageSlot,
  saveParticipantSourcePhoto,
} from '@/lib/participant-image-repository'
import { normalizeParticipantPhoto } from '@/lib/fan-image-generator'
import { toParticipantImageResponse } from '@/lib/participant-image-view'

function isAllowedParticipantImage(file: File) {
  const normalizedName = file.name.toLowerCase()
  const hasAllowedExtension = [...ALLOWED_PARTICIPANT_IMAGE_EXTENSIONS].some((extension) =>
    normalizedName.endsWith(extension),
  )

  return ALLOWED_PARTICIPANT_IMAGE_MIME_TYPES.has(file.type) || hasAllowedExtension
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> },
) {
  try {
    const { slotId } = await context.params
    const slot = await loadParticipantImageSlot(slotId)

    if (!slot) {
      return NextResponse.json({ error: 'Participant slot not found.' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('photo')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Attach a photo file before uploading.' }, { status: 400 })
    }

    if (!isAllowedParticipantImage(file)) {
      return NextResponse.json({ error: 'Participant photos must be JPEG, PNG, WebP, HEIC, or HEIF.' }, { status: 400 })
    }

    console.info('Saving participant source photo.', {
      slotId,
      mimeType: file.type,
      originalByteLength: file.size,
    })

    const normalizedPhoto = await normalizeParticipantPhoto(new Uint8Array(await file.arrayBuffer()), {
      mimeType: file.type,
      fileName: file.name,
    })
    await saveParticipantSourcePhoto(slotId, {
      photoMimeType: normalizedPhoto.mimeType,
      photoData: normalizedPhoto.bytes,
    })

    const refreshed = await loadParticipantImageSlot(slotId)
    console.info('Saved participant source photo.', {
      slotId,
      mimeType: refreshed?.photoMimeType ?? null,
      storedByteLength: refreshed?.photoData?.byteLength ?? 0,
    })

    return NextResponse.json(toParticipantImageResponse(refreshed!))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload participant photo.'
    const status =
      message.includes('2MB') ||
      message.includes('JPEG, PNG, WebP, HEIC, or HEIF') ||
      message.includes('HEIC/HEIF')
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
