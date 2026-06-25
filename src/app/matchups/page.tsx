import { MatchupsPage } from '@/components/matchups-page'
import { buildAllocationDisplayState } from '@/lib/allocation-status'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { loadFixtures } from '@/lib/fixture-provider'
import { buildLeaderboardData } from '@/lib/leaderboard'
import { buildMatchups, selectDisplayFixtures, selectPreviousFixtures } from '@/lib/matchups'
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

  let matchups
  let previousMatchups
  let warnings
  let players
  let teamDetailsByName

  try {
    const draw = await getOrCreateDraw(7, result.teams)
    const fixtureResult = await loadFixtures()
    const displayFixtures = selectDisplayFixtures(fixtureResult.fixtures, fixtureResult.fixtures.length)
    const previousFixtures = selectPreviousFixtures(fixtureResult.fixtures)
    const currentMatchupResult = buildMatchups(draw, displayFixtures, {})
    const previousMatchupResult = buildMatchups(draw, previousFixtures, {})
    matchups = currentMatchupResult.matchups
    previousMatchups = previousMatchupResult.matchups
    warnings = [...fixtureResult.warnings, ...currentMatchupResult.warnings, ...previousMatchupResult.warnings]
    players = buildLeaderboardData(result.teams, draw, fixtureResult.fixtures, fixtureResult.warnings).players
    teamDetailsByName = buildAllocationDisplayState(result.teams, draw, fixtureResult.fixtures).teamDetailsByName
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
      matchups={matchups}
      previousMatchups={previousMatchups}
      warnings={warnings}
      players={players}
      teamDetailsByName={teamDetailsByName}
    />
  )
}
