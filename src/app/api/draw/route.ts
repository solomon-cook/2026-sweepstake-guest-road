import { NextResponse } from 'next/server'
import { getOrCreateDraw, shuffleDraw, updateDrawNames } from '@/lib/draw-repository'
import { loadTeamScores } from '@/lib/team-repository'
import type { PlayerCount } from '@/lib/types'

function parsePlayerCount(value: unknown): PlayerCount | null {
  return value === 7 || value === 8 || value === 9 ? value : null
}

async function loadTeamState() {
  const teamResult = await loadTeamScores()

  if (teamResult.status !== 'ready') {
    return NextResponse.json(
      { error: teamResult.status === 'error' ? teamResult.message : 'Team data is unavailable.' },
      { status: 500 },
    )
  }

  return teamResult.teams
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const playerCount = parsePlayerCount(Number(url.searchParams.get('playerCount')))

  if (!playerCount) {
    return NextResponse.json({ error: 'Invalid playerCount.' }, { status: 400 })
  }

  const teams = await loadTeamState()

  if (teams instanceof NextResponse) {
    return teams
  }

  const draw = await getOrCreateDraw(playerCount, teams)
  return NextResponse.json(draw)
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { names?: string[]; playerCount?: number }
  const playerCount = parsePlayerCount(body.playerCount)

  if (!playerCount || !Array.isArray(body.names)) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const teams = await loadTeamState()

  if (teams instanceof NextResponse) {
    return teams
  }

  const draw = await updateDrawNames(playerCount, body.names, teams)
  return NextResponse.json(draw)
}

export async function POST(request: Request) {
  const body = (await request.json()) as { playerCount?: number }
  const playerCount = parsePlayerCount(body.playerCount)

  if (!playerCount) {
    return NextResponse.json({ error: 'Invalid playerCount.' }, { status: 400 })
  }

  const teams = await loadTeamState()

  if (teams instanceof NextResponse) {
    return teams
  }

  const draw = await shuffleDraw(playerCount, teams)
  return NextResponse.json(draw)
}
