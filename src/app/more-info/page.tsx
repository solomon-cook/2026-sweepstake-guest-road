import { MoreInfoPage } from '@/components/more-info-page'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'

export default async function MoreInfoRoute() {
  const result = await loadTeamScores()

  if (result.status !== 'ready') {
    throw new Error('More info page requires seeded team data.')
  }

  return <MoreInfoPage teamScores={result.teams} />
}
