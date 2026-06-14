import { HeaderLinks } from '@/components/header-links'
import { MatchupCard } from '@/components/matchup-card'
import { PreviousMatchupsToggle } from '@/components/previous-matchups-toggle'
import type { MatchupView } from '@/lib/types'

export function MatchupsPage({
  matchups,
  previousMatchups,
  warnings,
}: {
  matchups: MatchupView[]
  previousMatchups: MatchupView[]
  warnings: string[]
}) {
  return (
    <main className="page-shell matchup-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Matchups</h1>
        </div>
        <HeaderLinks />
      </section>

      {warnings.length ? (
        <section className="matchup-warning" aria-label="Matchup warnings">
          {warnings.slice(0, 4).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}

      <section className="matchup-list" aria-label="Current and upcoming matchups">
        <PreviousMatchupsToggle matchups={previousMatchups} />

        {matchups.length ? (
          matchups.map((matchup) => (
            <MatchupCard
              key={matchup.fixture.id}
              matchup={matchup}
              label={matchup.fixture.status === 'live' ? 'Current match' : 'Upcoming match'}
            />
          ))
        ) : (
          <article className="matchup-empty">
            <p className="section-kicker">No fixtures</p>
            <h2>No current or upcoming fixtures were returned.</h2>
            <p>Reload later once the free fixture sources publish the next World Cup matches.</p>
          </article>
        )}
      </section>
    </main>
  )
}
