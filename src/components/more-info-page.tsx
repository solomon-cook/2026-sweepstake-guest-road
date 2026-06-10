import { HeaderLinks } from '@/components/header-links'
import { formatScore } from '@/lib/formatters'
import { SCORE_SNAPSHOT } from '@/lib/team-source'
import type { TeamScore } from '@/lib/types'

export function MoreInfoPage({ teamScores }: { teamScores: TeamScore[] }) {
  const topTeams = teamScores.slice(0, 12)
  const totalScore = teamScores.reduce((sum, team) => sum + team.score, 0)
  const averageScore = totalScore / teamScores.length
  const scoreSpread = teamScores[0].score - teamScores[teamScores.length - 1].score
  const deviation = (scoreSpread / averageScore) * 100

  return (
    <main className="page-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>More info</h1>
        </div>
        <HeaderLinks />
      </section>

      <section className="details-panel">
        <div className="metrics-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">More info</p>
              <h2>Fairness and source data</h2>
            </div>
            <p>{SCORE_SNAPSHOT.date}</p>
          </div>

          <div className="metric-strip">
            <article>
              <span>Average team</span>
              <strong>{formatScore(averageScore)}</strong>
            </article>
            <article>
              <span>Spread</span>
              <strong>{formatScore(scoreSpread)}</strong>
            </article>
            <article>
              <span>Deviation</span>
              <strong>{formatScore(deviation)}%</strong>
            </article>
            <article>
              <span>Total teams</span>
              <strong>{teamScores.length}</strong>
            </article>
          </div>

          <div className="snapshot-card">
            <p className="snapshot-label">{SCORE_SNAPSHOT.sourceLabel}</p>
            <p className="snapshot-note">{SCORE_SNAPSHOT.sourceNote}</p>
          </div>

          <div className="favorites-card">
            <div className="favorites-heading">
              <h2>Top teams</h2>
              <p>Top 10 cards glow yellow. The rest of the top half glow green.</p>
            </div>

            <div className="favorites-list">
              {topTeams.map((team) => (
                <div key={team.name} className="favorite-row">
                  <div>
                    <span className="favorite-rank">#{team.rank}</span>
                    <strong>{team.name}</strong>
                  </div>
                  <div className="favorite-meta">
                    <span>Group {team.group}</span>
                    <span>{formatScore(team.score)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
