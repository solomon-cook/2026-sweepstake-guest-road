import { MatchupsPage } from '@/components/matchups-page'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { loadMatchupData } from '@/lib/fixture-provider'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'

function SetupState({ title, body }: { title: string; body: string }) {
  return (
    <main className="page-shell">
      <section className="setup-card">
        <p className="eyebrow">Matchups</p>
        <h1>{title}</h1>
        <p className="intro">{body}</p>
      </section>
    </main>
  )
}

export default async function MatchupsRoute() {
  const result = await loadTeamScores()

  if (result.status !== 'ready') {
    return (
      <SetupState
        title="The app cannot load the matchup board yet."
        body={result.status === 'error' ? result.message : 'Team data is unavailable.'}
      />
    )
  }

  let matchupData

  try {
    const draw = await getOrCreateDraw(7, result.teams)
    matchupData = await loadMatchupData(draw)
  } catch (error) {
    return (
      <SetupState
        title="The app cannot load the matchup board yet."
        body={error instanceof Error ? error.message : 'Unknown error while loading matchups.'}
      />
    )
  }

  return (
    <MatchupsPage
      matchups={matchupData.matchups}
      previousMatchups={matchupData.previousMatchups}
      warnings={matchupData.warnings}
    />
  )
}
