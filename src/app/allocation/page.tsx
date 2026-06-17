import { SweepstakeClient } from '@/components/sweepstake-client'
import { buildAllocationDisplayState } from '@/lib/allocation-status'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { loadFixtures } from '@/lib/fixture-provider'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'

function SetupState({
  title,
  body,
  steps,
}: {
  title: string
  body: string
  steps: string[]
}) {
  return (
    <main className="page-shell">
      <section className="setup-card">
        <p className="eyebrow">Database Setup</p>
        <h1>{title}</h1>
        <p className="intro">{body}</p>
        <ol className="setup-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  )
}

export default async function AllocationPage() {
  const playerCount = 7
  const result = await loadTeamScores()

  if (result.status === 'ready') {
    let initialDraw

    try {
      initialDraw = await getOrCreateDraw(playerCount, result.teams)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error while loading the draw.'

      return (
        <SetupState
          title="The app cannot read the persisted draw yet."
          body={message}
          steps={[
            'Check that POSTGRES_URL or DATABASE_URL points at the existing production database.',
            'Reduce DATABASE_POOL_MAX or wait for stale database connections to close.',
            'Reload the page.',
          ]}
        />
      )
    }

    const fixtureResult = await loadFixtures()
    const allocationDisplayState = buildAllocationDisplayState(result.teams, initialDraw, fixtureResult.fixtures)

    return <SweepstakeClient initialDraw={initialDraw} allocationDisplayState={allocationDisplayState} />
  }

  if (result.status === 'empty') {
    return (
      <SetupState
        title="The database is connected but the team table is empty."
        body="Seed the persisted team scores once, then the app will stop relying on any local score file at runtime."
        steps={[
          'Confirm this is the intended empty database.',
          'Run npm run db:seed only if there is no existing draw allocation to preserve.',
          'Reload the page.',
        ]}
      />
    )
  }

  return (
    <SetupState
      title="The app cannot read the Prisma database yet."
      body={result.message}
      steps={[
        'Check that POSTGRES_URL or DATABASE_URL points at the existing database.',
        'Reduce DATABASE_POOL_MAX or wait for stale database connections to close.',
        'Reload the page.',
      ]}
    />
  )
}
