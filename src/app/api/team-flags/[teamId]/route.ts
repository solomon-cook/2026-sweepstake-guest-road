import { NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/prisma'

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await context.params
    const prisma = getPrismaClient()
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        flagImageBytes: true,
        flagImageMimeType: true,
      },
    })

    if (!team?.flagImageBytes) {
      return new NextResponse('Flag not found.', { status: 404 })
    }

    return new NextResponse(team.flagImageBytes, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': team.flagImageMimeType || 'image/jpeg',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load flag image.'
    return new NextResponse(message, { status: 500 })
  }
}
