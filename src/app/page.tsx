import { cookies } from 'next/headers'
import { SweepstakeClient } from '@/components/sweepstake-client'
import { getOrCreateDraw } from '@/lib/draw-repository'
import { PLAYER_COUNT_COOKIE, toPlayerCount } from '@/lib/player-count'
import { loadTeamScores } from '@/lib/team-repository'

export const dynamic = 'force-dynamic'

function SetupState({ title, body }: { title: string; body: string }) {
  return (
    <main className="page-shell">
      <section className="setup-card">
        <p className="eyebrow">Database Setup</p>
        <h1>{title}</h1>
        <p className="intro">{body}</p>
        <ol className="setup-steps">
          <li>Set `DATABASE_URL` for this project.</li>
          <li>Run `npm run db:push` to create the `Team` table.</li>
          <li>Run `npm run db:seed` to load the 48 seeded teams and scores.</li>
          <li>Reload the page.</li>
        </ol>
      </section>
    </main>
  )
}

export default async function Page() {
  const cookieStore = await cookies()
  const playerCount = toPlayerCount(cookieStore.get(PLAYER_COUNT_COOKIE)?.value) ?? 7
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
        />
      )
    }

    return <SweepstakeClient initialDraw={initialDraw} />
  }

  if (result.status === 'empty') {
    return (
      <SetupState
        title="The database is connected but the team table is empty."
        body="Seed the persisted team scores once, then the app will stop relying on any local score file at runtime."
      />
    )
  }

  return (
    <SetupState
      title="The app cannot read the Prisma database yet."
      body={result.message}
    />
  )
}
