'use client'

import { useState } from 'react'
import { CardPackOpening } from '@/components/card-pack-opening'
import { HeaderLinks } from '@/components/header-links'
import { openPack as requestOpenPack } from '@/lib/card-pack'
import { formatScore } from '@/lib/formatters'
import type { PersistedBundle, PersistedDraw, PlayerCount } from '@/lib/types'

export function SweepstakeClient({
  initialDraw,
}: {
  initialDraw: PersistedDraw
}) {
  const [playerCount] = useState<PlayerCount>(initialDraw.playerCount)
  const [draw, setDraw] = useState(initialDraw)
  const [isSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeBundle, setActiveBundle] = useState<PersistedBundle | null>(null)
  const [pendingDraw, setPendingDraw] = useState<PersistedDraw | null>(null)

  const allocation = draw.allocation
  const rankedBundles = [...allocation.bundles].sort(
    (left, right) =>
      right.totalScore - left.totalScore || left.playerName.localeCompare(right.playerName),
  )

  function closeRevealFlow() {
    setActiveBundle(null)
    setPendingDraw(null)
  }

  function startReveal(bundle: PersistedBundle) {
    if (bundle.isRevealed || isSaving || activeBundle) {
      return
    }

    setError('')
    setPendingDraw(null)
    setActiveBundle(bundle)
  }

  async function openActivePack() {
    if (!activeBundle) {
      throw new Error('No pack selected.')
    }

    // Security boundary: /api/draw returns the persisted server/app decision for this slot.
    // The browser does not choose the sweepstake outcome; it only animates the returned cards.
    const response = await requestOpenPack({
      playerCount,
      slotId: activeBundle.slotId,
    })
    setPendingDraw(response.draw)
    return response.result
  }

  function completeReveal() {
    if (pendingDraw) {
      setDraw(pendingDraw)
    }
  }

  return (
    <main className="page-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">2026 World Cup - Guest Road</p>
          <h1>Sweepstake</h1>
        </div>
        <HeaderLinks />
      </section>

      <section className="results-panel">
        <div className="results-heading">
          <div>
            <p className="section-kicker">Allocation</p>
            <h2>{playerCount} players</h2>
            <p>Reveal each player&apos;s teams one pack at a time.</p>
          </div>
        </div>

        <div className="bundle-grid">
          {rankedBundles.map((bundle) => (
            <article
              key={bundle.slotId}
              className={`bundle-card ${bundle.isRevealed ? 'is-revealed' : 'is-hidden'}`}
            >
              <header>
                <p>{bundle.playerName}</p>
                {bundle.isRevealed ? <span>{bundle.teams.length} teams</span> : null}
              </header>

              {bundle.isRevealed ? (
                <ul className="bundle-team-list">
                  {bundle.teams.map((team) => (
                    <li key={team.name}>
                      <div>
                        <span>
                          {team.flag} {team.name}
                        </span>
                        <small>
                          Rank #{team.rank} · Group {team.group}
                        </small>
                      </div>
                      <strong>{formatScore(team.score)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bundle-hidden-state">
                  <button
                    type="button"
                    className="reveal-button"
                    onClick={() => startReveal(bundle)}
                    disabled={isSaving || Boolean(activeBundle)}
                  >
                    Reveal teams
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
      </section>

      {activeBundle ? (
        <div className="reveal-overlay" role="dialog" aria-modal="true" aria-labelledby="reveal-title">
          <div className="reveal-modal">
            <CardPackOpening
              title={`${activeBundle.playerName}'s teams`}
              subtitle="Open the pack to reveal the teams already assigned to this player."
              openPack={openActivePack}
              onClose={closeRevealFlow}
              onReveal={completeReveal}
              onError={(nextError) => setError(nextError.message)}
            />
          </div>
        </div>
      ) : null}
    </main>
  )
}
