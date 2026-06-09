'use client'

import { startTransition, useEffect, useState } from 'react'
import { generateBalancedAllocation, rankAllocation } from '@/lib/allocator'
import { SCORE_SNAPSHOT } from '@/lib/team-source'
import type { AllocationResult, PlayerCount, TeamScore } from '@/lib/types'

const PLAYER_OPTIONS: PlayerCount[] = [7, 8, 9]
const INITIAL_NAMES = [
  'Sam Felton',
  'Sam Robinson',
  'Dan Blackford',
  'Dan Tarrant',
  'Solomon Cook',
  'Navid Lorchi',
  'Callum Fisher',
  '',
  '',
]

function formatScore(value: number) {
  return value.toFixed(2)
}

export function SweepstakeClient({ teamScores }: { teamScores: TeamScore[] }) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(7)
  const [playerNames, setPlayerNames] = useState(INITIAL_NAMES)
  const [shuffleCount, setShuffleCount] = useState(0)
  const [allocation, setAllocation] = useState<AllocationResult>(() =>
    generateBalancedAllocation(teamScores, INITIAL_NAMES, 7),
  )

  useEffect(() => {
    startTransition(() => {
      setAllocation(generateBalancedAllocation(teamScores, playerNames, playerCount))
    })
  }, [playerCount, playerNames, shuffleCount, teamScores])

  const metrics = rankAllocation(allocation)
  const visibleNames = playerNames.slice(0, playerCount)
  const topTeams = teamScores.slice(0, 12)

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Balanced bundles, not pure luck of the draw.</h1>
          <p className="intro">
            Teams are grouped by strength, then each player gets a mix from across those groups so
            every bundle has a fair spread of stronger, middle, and weaker sides.
          </p>
        </div>

        <div className="snapshot-card">
          <p className="snapshot-label">{SCORE_SNAPSHOT.sourceLabel}</p>
          <p className="snapshot-date">{SCORE_SNAPSHOT.date}</p>
          <p className="snapshot-note">{SCORE_SNAPSHOT.sourceNote}</p>
          <dl className="snapshot-grid">
            <div>
              <dt>Teams</dt>
              <dd>{teamScores.length}</dd>
            </div>
            <div>
              <dt>Total score</dt>
              <dd>{SCORE_SNAPSHOT.totalScore.toFixed(0)}</dd>
            </div>
            <div>
              <dt>Best balance</dt>
              <dd>{metrics.balanceLabel}</dd>
            </div>
            <div>
              <dt>Spread</dt>
              <dd>{formatScore(metrics.scoreSpread)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="control-panel">
        <div className="picker-card">
          <p className="section-kicker">Players</p>
          <div className="count-switcher" aria-label="Player count">
            {PLAYER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={option === playerCount ? 'is-active' : ''}
                onClick={() => setPlayerCount(option)}
              >
                {option} players
              </button>
            ))}
          </div>

          <div className="name-grid">
            {visibleNames.map((name, index) => (
              <label key={index} className="name-field">
                <span>Slot {index + 1}</span>
                <input
                  value={name}
                  placeholder={`Player ${index + 1}`}
                  onChange={(event) => {
                    const nextNames = [...playerNames]
                    nextNames[index] = event.target.value
                    setPlayerNames(nextNames)
                  }}
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            className="shuffle-button"
            onClick={() => setShuffleCount((count) => count + 1)}
          >
            Shuffle / Re-draw
          </button>
        </div>

        <div className="metrics-card">
          <p className="section-kicker">Fairness</p>
          <div className="metric-strip">
            <article>
              <span>Average bundle</span>
              <strong>{formatScore(metrics.averageScore)}</strong>
            </article>
            <article>
              <span>Spread</span>
              <strong>{formatScore(metrics.scoreSpread)}</strong>
            </article>
            <article>
              <span>Deviation</span>
              <strong>{formatScore(metrics.percentDeviation)}%</strong>
            </article>
            <article>
              <span>Team count spread</span>
              <strong>{metrics.teamCountSpread}</strong>
            </article>
          </div>

          <div className="favorites-card">
            <div className="favorites-heading">
              <h2>Most likely teams</h2>
              <p>Top 12 by normalized title score</p>
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

      <section className="results-panel">
        <div className="results-heading">
          <div>
            <p className="section-kicker">Allocation</p>
            <h2>Balanced bundles for {playerCount} players</h2>
          </div>
          <p>
            Blank slots automatically fall back to <code>Player n</code>.
          </p>
        </div>

        <div className="bundle-grid">
          {allocation.bundles.map((bundle, index) => (
            <article key={`${bundle.playerName}-${index}`} className="bundle-card">
              <header>
                <div>
                  <p>{bundle.playerName}</p>
                  <h3>{formatScore(bundle.totalScore)} pts</h3>
                </div>
                <span>{bundle.teams.length} teams</span>
              </header>

              <ul>
                {bundle.teams.map((team) => (
                  <li key={team.name}>
                    <span>{team.name}</span>
                    <span>
                      G{team.group} · {formatScore(team.score)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
