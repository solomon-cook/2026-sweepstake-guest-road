import { MoreInfoPage } from '@/components/more-info-page'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'

export default async function MoreInfoRoute() {
  const result = await loadTeamScores()

  if (result.status !== 'ready') {
    throw new Error('More info page requires seeded team data.')
  }

  const initialDraw = await getOrCreateDraw(7, result.teams)

  return <MoreInfoPage initialDraw={initialDraw} teamScores={result.teams} />
}
