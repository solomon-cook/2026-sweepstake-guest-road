import { NextResponse } from 'next/server'
import { generateParticipantFanImages } from '@/lib/fan-image-generator'
import { loadParticipantImageSlot } from '@/lib/participant-image-repository'
import { toParticipantImageResponse } from '@/lib/participant-image-view'

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> },
) {
  const { slotId } = await context.params

  try {
    const url = new URL(request.url)
    const force = url.searchParams.get('force') === '1'
    const slot = await generateParticipantFanImages(slotId, { force })

    if (!slot) {
      return NextResponse.json({ error: 'Participant slot not found.' }, { status: 404 })
    }

    return NextResponse.json(toParticipantImageResponse(slot))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate participant fan images.'
    const slot = await loadParticipantImageSlot(slotId)

    return NextResponse.json(
      slot ? { ...toParticipantImageResponse(slot), error: message } : { error: message },
      { status: 500 },
    )
  }
}
