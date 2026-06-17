import type { Metadata } from 'next'
import { TournamentPage } from '@/components/leaderboard-page'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { loadFixtures } from '@/lib/fixture-provider'
import { buildLeaderboardData } from '@/lib/leaderboard'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Tournament',
}

function SetupState({ title, body }: { title: string; body: string }) {
  return (
    <main className="page-shell">
      <section className="setup-card">
        <p className="eyebrow">Tournament</p>
        <h1>{title}</h1>
        <p className="intro">{body}</p>
      </section>
    </main>
  )
}

export default async function LeaderboardRoute() {
  const result = await loadTeamScores()

  if (result.status !== 'ready') {
    return (
      <SetupState
        title="The app cannot load the tournament page yet."
        body={result.status === 'error' ? result.message : 'Team data is unavailable.'}
      />
    )
  }

  let data

  try {
    const draw = await getOrCreateDraw(7, result.teams)
    const fixtureResult = await loadFixtures()
    data = buildLeaderboardData(result.teams, draw, fixtureResult.fixtures, fixtureResult.warnings)
  } catch (error) {
    return (
      <SetupState
        title="The app cannot load the tournament page yet."
        body={error instanceof Error ? error.message : 'Unknown error while loading tournament data.'}
      />
    )
  }

  return <TournamentPage data={data} />
}
