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
  const rankedBundles = [...allocation.bundles].sort(
    (left, right) =>
      right.totalScore - left.totalScore || left.playerName.localeCompare(right.playerName),
  )

  return (
    <main className="page-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Players and bundles</h1>
        </div>

        <button
          type="button"
          className="shuffle-button"
          onClick={() => setShuffleCount((count) => count + 1)}
        >
          Shuffle draw
        </button>
      </section>

      <section className="results-panel">
        <div className="results-heading">
          <div>
            <p className="section-kicker">Allocation</p>
            <h2>{playerCount} players</h2>
            <p>Ordered by most likely to win.</p>
          </div>

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
        </div>

        <div className="bundle-grid">
          {rankedBundles.map((bundle, index) => (
            <article key={`${bundle.playerName}-${index}`} className="bundle-card">
              <header>
                <div>
                  <p>{bundle.playerName}</p>
                </div>
                <span>{bundle.teams.length} teams</span>
              </header>

              <ul>
                {bundle.teams.map((team) => (
                  <li key={team.name}>
                    <span>{team.name}</span>
                    <span>G{team.group}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="details-panel">
        <div className="picker-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Participants</p>
              <h2>Edit names</h2>
            </div>
            <p>
              Blank slots automatically fall back to <code>Player n</code>.
            </p>
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
        </div>

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
            <article>
              <span>Balance</span>
              <strong>{metrics.balanceLabel}</strong>
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
              <p>Highest normalized scores in the draw pool.</p>
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
