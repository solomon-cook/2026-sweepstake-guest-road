'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { CardPackOpening } from '@/components/card-pack-opening'
import { HeaderLinks } from '@/components/header-links'
import { openPack as requestOpenPack } from '@/lib/card-pack'
import { formatScore } from '@/lib/formatters'
import type { PersistedBundle, PersistedDraw, PlayerCount } from '@/lib/types'

function hasPlayerName(bundle: PersistedBundle) {
  return bundle.playerName.trim().length > 0
}

export function SweepstakeClient({
  initialDraw,
}: {
  initialDraw: PersistedDraw
}) {
  const [playerCount] = useState<PlayerCount>(initialDraw.playerCount)
  const [draw, setDraw] = useState(initialDraw)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [activeBundle, setActiveBundle] = useState<PersistedBundle | null>(null)
  const [pendingDraw, setPendingDraw] = useState<PersistedDraw | null>(null)

  const allocation = draw.allocation
  const claimedBundles = allocation.bundles
    .filter(hasPlayerName)
    .sort((left, right) => left.slotIndex - right.slotIndex)
  const claimedPlayerCount = claimedBundles.length
  const availableSlots = playerCount - claimedPlayerCount
  const canAddPlayer = availableSlots > 0

  function closeRevealFlow() {
    setActiveBundle(null)
    setPendingDraw(null)
  }

  function startReveal(bundle: PersistedBundle) {
    if (!hasPlayerName(bundle) || bundle.isRevealed || isSaving || activeBundle) {
      return
    }

    setError('')
    setPendingDraw(null)
    setActiveBundle(bundle)
  }

  async function claimPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canAddPlayer) {
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const response = await fetch('/api/draw', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'claim-slot',
          playerCount,
          playerName,
        }),
      })
      const nextState = (await response.json()) as
        | { claimedSlotId: string; draw: PersistedDraw }
        | { error: string }

      if (!response.ok || 'error' in nextState) {
        throw new Error('error' in nextState ? nextState.error : 'Failed to claim a pack.')
      }

      const claimedBundle = nextState.draw.allocation.bundles.find(
        (bundle) => bundle.slotId === nextState.claimedSlotId,
      )

      if (!claimedBundle) {
        throw new Error('The claimed pack could not be loaded.')
      }

      setDraw(nextState.draw)
      setPlayerName('')
      setShowJoinForm(false)
      setPendingDraw(null)
      setActiveBundle(claimedBundle)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to claim a pack.')
    } finally {
      setIsSaving(false)
    }
  }

  async function openActivePack() {
    if (!activeBundle) {
      throw new Error('No pack selected.')
    }

    setIsSaving(true)

    try {
      const response = await requestOpenPack({
        playerCount,
        slotId: activeBundle.slotId,
      })
      setPendingDraw(response.draw)
      return response.result
    } finally {
      setIsSaving(false)
    }
  }

  function completeReveal() {
    if (pendingDraw) {
      setDraw(pendingDraw)
    }
  }

  async function clearAllPlayers() {
    if (isSaving) {
      return
    }

    const shouldClear = window.confirm(
      'Clear all player names and hide every revealed pack? This cannot be undone.',
    )

    if (!shouldClear) {
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const response = await fetch('/api/draw', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear-players',
          playerCount,
        }),
      })
      const nextState = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextState) {
        throw new Error('error' in nextState ? nextState.error : 'Failed to clear players.')
      }

      closeRevealFlow()
      setShowJoinForm(false)
      setPlayerName('')
      setDraw(nextState)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to clear players.')
    } finally {
      setIsSaving(false)
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
            <h2>{claimedPlayerCount} of 7 players in</h2>
            <p>Claim a pack, then reveal the teams already assigned to it.</p>
          </div>
        </div>

        {claimedBundles.length ? (
          <div className="bundle-grid">
            {claimedBundles.map((bundle) => (
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
                          <span className="bundle-team-name">
                            {team.flagImageUrl ? (
                              <img
                                className="bundle-team-flag"
                                src={team.flagImageUrl}
                                alt={`${team.name} flag`}
                                width={20}
                                height={15}
                              />
                            ) : null}
                            {team.name}
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
        ) : (
          <div className="empty-state-card">
            <p className="section-kicker">First pack</p>
            <h3>No players have claimed a bundle yet.</h3>
            <p>Use the add player button below to take the next pack.</p>
          </div>
        )}

        {error ? <p className="error-copy">{error}</p> : null}

        {canAddPlayer ? (
          <div className="claim-section">
            {showJoinForm ? (
              <form className="claim-form" onSubmit={claimPack}>
                <label className="name-field">
                  <span>Your name</span>
                  <input
                    value={playerName}
                    placeholder="Add your name"
                    onChange={(event) => setPlayerName(event.target.value)}
                    disabled={isSaving}
                  />
                </label>
                <div className="claim-actions">
                  <button type="submit" className="secondary-button" disabled={isSaving}>
                    Claim bundle pack
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setPlayerName('')
                      setShowJoinForm(false)
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowJoinForm(true)}
                disabled={isSaving}
              >
                Add player
              </button>
            )}
          </div>
        ) : null}

        <div className="claim-section admin-form">
          <button
            type="button"
            className="secondary-button danger-button"
            onClick={clearAllPlayers}
            disabled={isSaving}
          >
            Clear all players
          </button>
        </div>
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
