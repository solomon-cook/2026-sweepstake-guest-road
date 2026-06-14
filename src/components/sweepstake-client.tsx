'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { CardPackOpening } from '@/components/card-pack-opening'
import { HeaderLinks } from '@/components/header-links'
import { openPack as requestOpenPack } from '@/lib/card-pack'
import type { PersistedBundle, PersistedDraw, PlayerCount } from '@/lib/types'

function hasPlayerName(bundle: PersistedBundle) {
  return bundle.playerName.trim().length > 0
}

function getBundleTeamRowClass(rank: number) {
  return rank <= 10 ? 'is-great-team' : ''
}

function mergeBundleImageState(draw: PersistedDraw, slotId: string, imageState: Partial<PersistedBundle>) {
  return {
    ...draw,
    allocation: {
      ...draw.allocation,
      bundles: draw.allocation.bundles.map((bundle) =>
        bundle.slotId === slotId ? { ...bundle, ...imageState } : bundle
      ),
    },
  }
}

function bundlePhotoStatus(bundle: PersistedBundle) {
  if (bundle.fanImageStatus === 'pending') {
    return 'Generating fan images...'
  }

  if (bundle.fanImageStatus === 'failed') {
    return 'Generation failed'
  }

  if (bundle.fanImageStatus === 'ready') {
    return 'Photo ready'
  }

  if (bundle.sourcePhotoUrl && !bundle.isRevealed) {
    return 'Waiting for reveal'
  }

  return ''
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
  const [activeImageSlotIds, setActiveImageSlotIds] = useState<string[]>([])

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

  function setImageBusy(slotId: string, isBusy: boolean) {
    setActiveImageSlotIds((current) =>
      isBusy ? (current.includes(slotId) ? current : [...current, slotId]) : current.filter((value) => value !== slotId),
    )
  }

  function isImageBusy(slotId: string) {
    return activeImageSlotIds.includes(slotId)
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

  async function requestFanImages(slotId: string, force = false) {
    setImageBusy(slotId, true)
    setError('')

    try {
      const response = await fetch(`/api/participants/${slotId}/fan-images${force ? '?force=1' : ''}`, {
        method: 'POST',
      })
      const nextState = (await response.json()) as
        | {
            slotId: string
            sourcePhotoUrl?: string | null
            fanImageStatus: PersistedBundle['fanImageStatus']
            fanImageTeamName?: string | null
            fanImageUrls?: PersistedBundle['fanImageUrls']
            error?: string | null
          }
        | { error: string }

      if (!response.ok || 'error' in nextState) {
        throw new Error(
          'error' in nextState
            ? nextState.error || 'Failed to generate fan images.'
            : 'Failed to generate fan images.',
        )
      }

      setDraw((current) =>
        mergeBundleImageState(current, slotId, {
          sourcePhotoUrl: nextState.sourcePhotoUrl ?? null,
          fanImageStatus: nextState.fanImageStatus,
          fanImageTeamName: nextState.fanImageTeamName ?? null,
          fanImageUrls: nextState.fanImageUrls ?? null,
        }),
      )
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : 'Failed to generate fan images.'
      setDraw((current) =>
        mergeBundleImageState(current, slotId, {
          fanImageStatus: 'failed',
        }),
      )
      setError(message)
    } finally {
      setImageBusy(slotId, false)
    }
  }

  async function uploadParticipantPhoto(slotId: string, file: File) {
    setImageBusy(slotId, true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('photo', file)
      const response = await fetch(`/api/participants/${slotId}/photo`, {
        method: 'POST',
        body: formData,
      })
      const nextState = (await response.json()) as
        | {
            slotId: string
            sourcePhotoUrl?: string | null
            fanImageStatus: PersistedBundle['fanImageStatus']
            fanImageTeamName?: string | null
            fanImageUrls?: PersistedBundle['fanImageUrls']
            error?: string | null
          }
        | { error: string }

      if (!response.ok || 'error' in nextState) {
        throw new Error(
          'error' in nextState
            ? nextState.error || 'Failed to upload participant photo.'
            : 'Failed to upload participant photo.',
        )
      }

      setDraw((current) =>
        mergeBundleImageState(current, slotId, {
          sourcePhotoUrl: nextState.sourcePhotoUrl ?? null,
          fanImageStatus: nextState.fanImageStatus,
          fanImageTeamName: nextState.fanImageTeamName ?? null,
          fanImageUrls: nextState.fanImageUrls ?? null,
        }),
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to upload participant photo.')
    } finally {
      setImageBusy(slotId, false)
    }
  }

  async function completeReveal() {
    if (pendingDraw) {
      setDraw(pendingDraw)

      const revealedBundle = pendingDraw.allocation.bundles.find(
        (bundle) => activeBundle && bundle.slotId === activeBundle.slotId,
      )

      if (
        revealedBundle?.sourcePhotoUrl &&
        revealedBundle.fanImageStatus !== 'ready' &&
        !isImageBusy(revealedBundle.slotId)
      ) {
        void requestFanImages(revealedBundle.slotId)
      }
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
            <p>Claim a place in the sweepstake and unpack some teams.</p>
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
                  <div className="bundle-card-heading">
                    <div>
                      <p>{bundle.playerName}</p>
                      {bundle.isRevealed ? <span>{bundle.teams.length} teams</span> : null}
                    </div>
                    {!bundle.sourcePhotoUrl ? (
                      <label className={`bundle-photo-button ${isImageBusy(bundle.slotId) ? 'is-disabled' : ''}`}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isImageBusy(bundle.slotId)}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0]

                            if (file) {
                              void uploadParticipantPhoto(bundle.slotId, file)
                            }

                            event.currentTarget.value = ''
                          }}
                        />
                        <span>Add photo</span>
                      </label>
                    ) : null}
                  </div>
                </header>

                {bundlePhotoStatus(bundle) ? (
                  <div className={`bundle-photo-status is-${bundle.fanImageStatus}`}>
                    <p>{bundlePhotoStatus(bundle)}</p>
                    {bundle.fanImageStatus === 'failed' ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void requestFanImages(bundle.slotId, true)}
                        disabled={isImageBusy(bundle.slotId)}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {bundle.isRevealed ? (
                  <ul className="bundle-team-list">
                    {bundle.teams.map((team) => (
                      <li key={team.name} className={getBundleTeamRowClass(team.rank)}>
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
                          <small>Group {team.group}</small>
                        </div>
                        <strong>#{team.rank}</strong>
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
            <p>Use the join button below to take the next pack.</p>
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
                Join Sweepstake
              </button>
            )}
          </div>
        ) : null}
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
