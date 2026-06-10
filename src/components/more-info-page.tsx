'use client'

import { useState } from 'react'
import { HeaderLinks } from '@/components/header-links'
import { formatScore } from '@/lib/formatters'
import { SCORE_SNAPSHOT } from '@/lib/team-source'
import type { PersistedDraw, TeamScore } from '@/lib/types'

const ADMIN_PASSWORD = 'Football'

export function MoreInfoPage({
  initialDraw,
  teamScores,
}: {
  initialDraw: PersistedDraw
  teamScores: TeamScore[]
}) {
  const [draw, setDraw] = useState(initialDraw)
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const topTeams = teamScores.slice(0, 12)
  const totalScore = teamScores.reduce((sum, team) => sum + team.score, 0)
  const averageScore = totalScore / teamScores.length
  const scoreSpread = teamScores[0].score - teamScores[teamScores.length - 1].score
  const deviation = (scoreSpread / averageScore) * 100
  const claimedPlayerCount = draw.allocation.bundles.filter((bundle) => bundle.playerName.trim()).length
  const revealedPlayerCount = draw.allocation.bundles.filter(
    (bundle) => bundle.playerName.trim() && bundle.isRevealed,
  ).length
  const passwordIsValid = password === ADMIN_PASSWORD

  async function runAdminAction(action: 'shuffle' | 'reset-reveals' | 'clear-players') {
    if (!passwordIsValid) {
      setError('Type Football exactly to unlock the controls.')
      setNotice('')
      return
    }

    if (
      action === 'clear-players' &&
      !window.confirm('Clear all player names and hide every revealed pack? This cannot be undone.')
    ) {
      return
    }

    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const response =
        action === 'shuffle'
          ? await fetch('/api/draw', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ playerCount: draw.playerCount }),
            })
          : await fetch('/api/draw', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action,
                playerCount: draw.playerCount,
              }),
            })

      const nextDraw = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextDraw) {
        throw new Error('error' in nextDraw ? nextDraw.error : 'Admin action failed.')
      }

      setDraw(nextDraw)
      setNotice(
        action === 'shuffle'
          ? 'Bundles shuffled and hidden again.'
          : action === 'reset-reveals'
            ? 'All claimed teams are hidden again.'
            : 'All player names were cleared and every pack is hidden again.',
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Admin action failed.')
    } finally {
      setIsSaving(false)
    }
  }

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

        <div className="metrics-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Admin</p>
              <h2>Draw controls</h2>
            </div>
            <p>Type Football to unlock shuffle and re-hide.</p>
          </div>

          <div className="metric-strip">
            <article>
              <span>Players claimed</span>
              <strong>{claimedPlayerCount}</strong>
            </article>
            <article>
              <span>Packs revealed</span>
              <strong>{revealedPlayerCount}</strong>
            </article>
            <article>
              <span>Balance</span>
              <strong>{draw.allocation.balanceLabel}</strong>
            </article>
            <article>
              <span>Score spread</span>
              <strong>{formatScore(draw.allocation.scoreSpread)}</strong>
            </article>
          </div>

          <div className="claim-form admin-form">
            <label className="name-field">
              <span>Password</span>
              <input
                value={password}
                placeholder='Password'
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSaving}
              />
            </label>
            <div className="claim-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void runAdminAction('shuffle')}
                disabled={isSaving || !passwordIsValid}
              >
                Shuffle bundles
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void runAdminAction('reset-reveals')}
                disabled={isSaving || !passwordIsValid}
              >
                Re-hide teams
              </button>
              <button
                type="button"
                className="secondary-button danger-button"
                onClick={() => void runAdminAction('clear-players')}
                disabled={isSaving || !passwordIsValid}
              >
                Clear all players
              </button>
            </div>
          </div>

          {notice ? <p className="sync-copy">{notice}</p> : null}
          {error ? <p className="error-copy">{error}</p> : null}
        </div>
      </section>
    </main>
  )
}
