import { ParticipantsPage } from '@/components/participants-page'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'

export default async function ParticipantsRoute() {
  const result = await loadTeamScores()

  if (result.status !== 'ready') {
    throw new Error('Participants page requires seeded team data.')
  }

  const initialDraw = await getOrCreateDraw(7, result.teams)

  return <ParticipantsPage initialDraw={initialDraw} />
}
