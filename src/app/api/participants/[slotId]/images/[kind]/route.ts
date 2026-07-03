import { NextResponse } from 'next/server'
import { loadParticipantImageBytes } from '@/lib/participant-image-repository'

export async function GET(
  _request: Request,
  context: { params: Promise<{ slotId: string; kind: string }> },
) {
  try {
    const { slotId, kind } = await context.params

    if (kind !== 'source' && kind !== 'neutral' && kind !== 'ecstatic' && kind !== 'devastated') {
      return new NextResponse('Unknown participant image kind.', { status: 404 })
    }

    const image = await loadParticipantImageBytes(slotId, kind)

    if (image.status !== 'ready') {
      return new NextResponse(
        image.status === 'missing-slot' ? 'Participant slot not found.' : 'Participant image not found.',
        { status: 404 },
      )
    }

    return new NextResponse(image.bytes, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'Content-Type': image.mimeType,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load participant image.'
    return new NextResponse(message, { status: 500 })
  }
}
