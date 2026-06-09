'use client'

import { useState } from 'react'
import { SCORE_SNAPSHOT } from '@/lib/team-source'
import type { PersistedDraw, PlayerCount, TeamScore } from '@/lib/types'

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

export function SweepstakeClient({
  initialDraw,
  teamScores,
}: {
  initialDraw: PersistedDraw
  teamScores: TeamScore[]
}) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(initialDraw.playerCount)
  const [playerNames, setPlayerNames] = useState([
    ...initialDraw.allocation.bundles.map((bundle) => bundle.playerName),
    ...INITIAL_NAMES,
  ])
  const [draw, setDraw] = useState(initialDraw)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const allocation = draw.allocation
  const metrics = allocation
  const visibleNames = playerNames.slice(0, playerCount)
  const topTeams = teamScores.slice(0, 12)
  const rankedBundles = [...allocation.bundles].sort(
    (left, right) =>
      right.totalScore - left.totalScore || left.playerName.localeCompare(right.playerName),
  )

  async function loadDraw(nextPlayerCount: PlayerCount) {
    setIsSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/draw?playerCount=${nextPlayerCount}`, {
        cache: 'no-store',
      })
      const nextDraw = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextDraw) {
        throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to load draw.')
      }

      setDraw(nextDraw)
      setPlayerCount(nextPlayerCount)
      setPlayerNames([
        ...nextDraw.allocation.bundles.map((bundle) => bundle.playerName),
        '',
        '',
      ])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load draw.')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveNames() {
    setIsSaving(true)
    setError('')

    try {
      const response = await fetch('/api/draw', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerCount,
          names: visibleNames,
        }),
      })
      const nextDraw = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextDraw) {
        throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to save names.')
      }

      setDraw(nextDraw)
      setPlayerNames([
        ...nextDraw.allocation.bundles.map((bundle) => bundle.playerName),
        '',
        '',
      ])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save names.')
    } finally {
      setIsSaving(false)
    }
  }

  async function shufflePersistedDraw() {
    setIsSaving(true)
    setError('')

    try {
      const response = await fetch('/api/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerCount }),
      })
      const nextDraw = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextDraw) {
        throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to shuffle draw.')
      }

      setDraw(nextDraw)
      setPlayerNames([
        ...nextDraw.allocation.bundles.map((bundle) => bundle.playerName),
        '',
        '',
      ])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to shuffle draw.')
    } finally {
      setIsSaving(false)
    }
  }

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
          onClick={shufflePersistedDraw}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Shuffle draw'}
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
                onClick={() => void loadDraw(option)}
                disabled={isSaving}
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

          <div className="panel-actions">
            <button type="button" className="secondary-button" onClick={saveNames} disabled={isSaving}>
              Save names to shared draw
            </button>
            <p className="sync-copy">This draw is shared across devices.</p>
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

          {error ? <p className="error-copy">{error}</p> : null}
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
