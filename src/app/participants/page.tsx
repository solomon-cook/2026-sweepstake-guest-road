import { cookies } from 'next/headers'
import { ParticipantsPage } from '@/components/participants-page'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { PLAYER_COUNT_COOKIE, toPlayerCount } from '@/lib/player-count'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'

export default async function ParticipantsRoute() {
  const cookieStore = await cookies()
  const playerCount = toPlayerCount(cookieStore.get(PLAYER_COUNT_COOKIE)?.value) ?? 7
  const result = await loadTeamScores()

  if (result.status !== 'ready') {
    throw new Error('Participants page requires seeded team data.')
  }

  const initialDraw = await getOrCreateDraw(playerCount, result.teams)

  return <ParticipantsPage initialDraw={initialDraw} />
}
