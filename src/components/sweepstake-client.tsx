'use client'

import dynamic from 'next/dynamic'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AllocationDisplayState, AllocationTeamDetail } from '@/lib/allocation-status'
import { HeaderLinks } from '@/components/header-links'
import {
  buildPlayerNextMatchups,
  buildPlayerPhotoFrames,
} from '@/lib/player-photo-frames'
import { openPack as requestOpenPack } from '@/lib/card-pack'
import { normalizeTeamName } from '@/lib/matchups'
import type { PersistedBundle, PersistedDraw, PlayerCount } from '@/lib/types'

const CardPackOpening = dynamic(() =>
  import('@/components/card-pack-opening').then((module) => module.CardPackOpening),
)
const PlayerPhotoLightbox = dynamic(() =>
  import('@/components/player-photo-lightbox').then((module) => module.PlayerPhotoLightbox),
)
const TeamDetailLightbox = dynamic(() =>
  import('@/components/team-detail-lightbox').then((module) => module.TeamDetailLightbox),
)

type ImageOperation = 'uploading' | 'uploading-and-generating' | 'generating'
type ParticipantPhotoPreview = {
  bundle: PersistedBundle
}

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])
const ALLOWED_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.heics', '.heifs']
const MAX_UPLOAD_FILE_BYTES = 4 * 1024 * 1024
const READY_STATUS_DISPLAY_MS = 3600
const PHOTO_CYCLE_INTERVAL_MS = 1900

type ParticipantImageApiResponse =
  | {
      slotId: string
      sourcePhotoUrl?: string | null
      fanImageStatus: PersistedBundle['fanImageStatus']
      fanImageError?: string | null
      fanImageTeamName?: string | null
      fanImageUrls?: PersistedBundle['fanImageUrls']
      error?: string | null
    }
  | { error: string }

function participantApiPath(slotId: string, path: string) {
  return `/api/participants/${encodeURIComponent(slotId)}${path}`
}

function hasPlayerName(bundle: PersistedBundle) {
  return bundle.playerName.trim().length > 0
}

function getBundleTeamRowClass(rank: number, isDimmed: boolean) {
  return [rank <= 10 ? 'is-great-team' : '', isDimmed ? 'is-dimmed-team' : ''].filter(Boolean).join(' ')
}

function getDisplayedBundleTeams(
  bundle: PersistedBundle,
  teamsByName: AllocationDisplayState['teamsByName'],
) {
  return [...bundle.teams].sort((left, right) => {
    const leftState = teamsByName[normalizeTeamName(left.name)]
    const rightState = teamsByName[normalizeTeamName(right.name)]
    const leftScore = leftState?.sortOrder ?? 0
    const rightScore = rightState?.sortOrder ?? 0

    return rightScore - leftScore || left.rank - right.rank || left.name.localeCompare(right.name)
  })
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

function isAllowedUploadFile(file: File) {
  const normalizedName = file.name.toLowerCase()
  return (
    ALLOWED_UPLOAD_TYPES.has(file.type) ||
    ALLOWED_UPLOAD_EXTENSIONS.some((extension) => normalizedName.endsWith(extension))
  )
}

async function readParticipantImageResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return { error: `Empty response from photo API (${response.status}).` } satisfies ParticipantImageApiResponse
  }

  if (text.trimStart().startsWith('<!DOCTYPE html') || response.headers.get('content-type')?.includes('text/html')) {
    return {
      error: `Photo API returned a server error (${response.status}). Check the server logs for the detailed error.`,
    } satisfies ParticipantImageApiResponse
  }

  try {
    return JSON.parse(text) as ParticipantImageApiResponse
  } catch {
    return { error: text } satisfies ParticipantImageApiResponse
  }
}

function bundlePhotoStatus(bundle: PersistedBundle, imageOperation?: ImageOperation, showReadyStatus = false) {
  if (imageOperation === 'uploading-and-generating') {
    return 'Uploading photo, then sending to OpenAI...'
  }

  if (imageOperation === 'uploading') {
    return 'Uploading photo...'
  }

  if (imageOperation === 'generating') {
    return 'Sending photo to OpenAI...'
  }

  if (bundle.fanImageStatus === 'pending') {
    return 'OpenAI is generating profile photos...'
  }

  if (bundle.fanImageStatus === 'failed') {
    const failurePrefix = bundle.sourcePhotoUrl ? 'OpenAI generation failed' : 'Photo upload failed'
    return bundle.fanImageError ? `${failurePrefix}: ${bundle.fanImageError}` : failurePrefix
  }

  if (bundle.fanImageStatus === 'ready' && showReadyStatus) {
    return 'Profile photos ready'
  }

  return ''
}

function getBundlePreviewImage(bundle: PersistedBundle, mood: 'neutral' | 'ecstatic' | 'devastated') {
  if (mood === 'ecstatic' && bundle.fanImageUrls?.ecstatic) {
    return {
      imageUrl: bundle.fanImageUrls.ecstatic,
      imageLabel: `Ecstatic AI profile photo for ${bundle.playerName}`,
    }
  }

  if (mood === 'devastated' && bundle.fanImageUrls?.devastated) {
    return {
      imageUrl: bundle.fanImageUrls.devastated,
      imageLabel: `Devastated AI profile photo for ${bundle.playerName}`,
    }
  }

  if (bundle.fanImageUrls?.neutral) {
    return {
      imageUrl: bundle.fanImageUrls.neutral,
      imageLabel: `Neutral AI profile photo for ${bundle.playerName}`,
    }
  }

  return null
}

function getBundlePhotoFrames(bundle: PersistedBundle) {
  return buildPlayerPhotoFrames({
    playerName: bundle.playerName,
    sourcePhotoUrl: bundle.sourcePhotoUrl,
    neutralPhotoUrl: bundle.fanImageUrls?.neutral,
    ecstaticPhotoUrl: bundle.fanImageUrls?.ecstatic,
    devastatedPhotoUrl: bundle.fanImageUrls?.devastated,
  })
}

export function SweepstakeClient({
  initialDraw,
  allocationDisplayState,
}: {
  initialDraw: PersistedDraw
  allocationDisplayState: AllocationDisplayState
}) {
  const [playerCount] = useState<PlayerCount>(initialDraw.playerCount)
  const [draw, setDraw] = useState(initialDraw)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [activeBundle, setActiveBundle] = useState<PersistedBundle | null>(null)
  const [activePhotoPreview, setActivePhotoPreview] = useState<ParticipantPhotoPreview | null>(null)
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<AllocationTeamDetail | null>(null)
  const [activePhotoFrameIndex, setActivePhotoFrameIndex] = useState(0)
  const [pendingDraw, setPendingDraw] = useState<PersistedDraw | null>(null)
  const [activeImageOperations, setActiveImageOperations] = useState<Record<string, ImageOperation>>({})
  const [recentlyReadyPhotos, setRecentlyReadyPhotos] = useState<Record<string, boolean>>({})
  const readyStatusTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const allocation = draw.allocation
  const claimedBundles = useMemo(
    () =>
      allocation.bundles
        .filter(hasPlayerName)
        .sort((left, right) => left.slotIndex - right.slotIndex),
    [allocation.bundles],
  )
  const claimedPlayerCount = claimedBundles.length
  const availableSlots = playerCount - claimedPlayerCount
  const canAddPlayer = availableSlots > 0

  useEffect(() => {
    const timers = readyStatusTimers.current

    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const activePhotoFrames = useMemo(
    () => (activePhotoPreview ? getBundlePhotoFrames(activePhotoPreview.bundle) : []),
    [activePhotoPreview],
  )
  const activePhotoNextMatchups = useMemo(
    () =>
      activePhotoPreview
        ? buildPlayerNextMatchups(
            activePhotoPreview.bundle.teams.map((team) => ({
              teamName: team.name,
              teamFlagImageUrl: team.flagImageUrl ?? team.flag ?? null,
              teamRank: team.rank,
            })),
            allocationDisplayState.teamDetailsByName,
          )
        : [],
    [activePhotoPreview, allocationDisplayState.teamDetailsByName],
  )
  const displayedTeamsBySlotId = useMemo(
    () =>
      Object.fromEntries(
        claimedBundles.map((bundle) => [
          bundle.slotId,
          getDisplayedBundleTeams(bundle, allocationDisplayState.teamsByName),
        ]),
      ),
    [claimedBundles, allocationDisplayState.teamsByName],
  )
  const currentPhotoFrame =
    activePhotoFrames.length > 0
      ? activePhotoFrames[activePhotoFrameIndex % activePhotoFrames.length]
      : null

  useEffect(() => {
    if (!activePhotoPreview || activePhotoFrames.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActivePhotoFrameIndex((current) => (current + 1) % activePhotoFrames.length)
    }, PHOTO_CYCLE_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [activePhotoFrames.length, activePhotoPreview])

  function closeRevealFlow() {
    setActiveBundle(null)
    setPendingDraw(null)
  }

  function closePhotoPreview() {
    setActivePhotoPreview(null)
    setActivePhotoFrameIndex(0)
  }

  function closeTeamDetail() {
    setSelectedTeamDetail(null)
  }

  function startReveal(bundle: PersistedBundle) {
    if (!hasPlayerName(bundle) || bundle.isRevealed || isSaving || activeBundle) {
      return
    }

    setError('')
    setPendingDraw(null)
    setActiveBundle(bundle)
  }

  function setImageOperation(slotId: string, operation: ImageOperation | null) {
    setActiveImageOperations((current) => {
      if (operation) {
        return { ...current, [slotId]: operation }
      }

      const nextOperations = { ...current }
      delete nextOperations[slotId]
      return nextOperations
    })
  }

  function isImageBusy(slotId: string) {
    return Boolean(activeImageOperations[slotId])
  }

  function getImageOperation(slotId: string) {
    return activeImageOperations[slotId]
  }

  function showReadyStatusBriefly(slotId: string) {
    if (readyStatusTimers.current[slotId]) {
      clearTimeout(readyStatusTimers.current[slotId])
    }

    setRecentlyReadyPhotos((current) => ({ ...current, [slotId]: true }))
    readyStatusTimers.current[slotId] = setTimeout(() => {
      setRecentlyReadyPhotos((current) => {
        const nextReadyPhotos = { ...current }
        delete nextReadyPhotos[slotId]
        return nextReadyPhotos
      })
      delete readyStatusTimers.current[slotId]
    }, READY_STATUS_DISPLAY_MS)
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
    setImageOperation(slotId, 'generating')
    setError('')

    try {
      const response = await fetch(participantApiPath(slotId, `/fan-images${force ? '?force=1' : ''}`), {
        method: 'POST',
      })
      const nextState = await readParticipantImageResponse(response)

      if (!response.ok || 'error' in nextState) {
        throw new Error(
          'error' in nextState
            ? nextState.error || 'Failed to generate fan images.'
            : 'Failed to generate fan images.',
        )
      }

      const imageState = {
        sourcePhotoUrl: nextState.sourcePhotoUrl ?? null,
        fanImageStatus: nextState.fanImageStatus,
        fanImageError: nextState.fanImageError ?? null,
        fanImageTeamName: nextState.fanImageTeamName ?? null,
        fanImageUrls: nextState.fanImageUrls ?? null,
      }

      setDraw((current) => mergeBundleImageState(current, slotId, imageState))
      setActivePhotoPreview((current) =>
        current?.bundle.slotId === slotId
          ? {
              bundle: { ...current.bundle, ...imageState },
            }
          : current,
      )

      if (imageState.fanImageStatus === 'ready') {
        showReadyStatusBriefly(slotId)
      }
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : 'Failed to generate fan images.'
      setDraw((current) =>
        mergeBundleImageState(current, slotId, {
          fanImageStatus: 'failed',
          fanImageError: message,
        }),
      )
      setError(message)
    } finally {
      setImageOperation(slotId, null)
    }
  }

  async function uploadParticipantPhoto(slotId: string, file: File, shouldGenerateImmediately: boolean) {
    let shouldRequestGeneration = false

    if (!isAllowedUploadFile(file)) {
      const message = 'Choose a JPEG, PNG, WebP, HEIC, or HEIF image.'
      setDraw((current) =>
        mergeBundleImageState(current, slotId, {
          fanImageStatus: 'failed',
          fanImageError: message,
        }),
      )
      setError(message)
      return
    }

    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      const message = 'Choose a photo smaller than 4MB before uploading.'
      setDraw((current) =>
        mergeBundleImageState(current, slotId, {
          fanImageStatus: 'failed',
          fanImageError: message,
        }),
      )
      setError(message)
      return
    }

    setImageOperation(slotId, shouldGenerateImmediately ? 'uploading-and-generating' : 'uploading')
    setError('')

    try {
      const formData = new FormData()
      formData.set('photo', file)
      const response = await fetch(participantApiPath(slotId, '/photo'), {
        method: 'POST',
        body: formData,
      })
      const nextState = await readParticipantImageResponse(response)

      if (!response.ok || 'error' in nextState) {
        throw new Error(
          'error' in nextState
            ? nextState.error || 'Failed to upload participant photo.'
            : 'Failed to upload participant photo.',
        )
      }

      const imageState = {
        sourcePhotoUrl: nextState.sourcePhotoUrl ?? null,
        fanImageStatus: nextState.fanImageStatus,
        fanImageError: nextState.fanImageError ?? null,
        fanImageTeamName: nextState.fanImageTeamName ?? null,
        fanImageUrls: nextState.fanImageUrls ?? null,
      }

      setDraw((current) => mergeBundleImageState(current, slotId, imageState))
      setActivePhotoPreview((current) =>
        current?.bundle.slotId === slotId
          ? {
              bundle: { ...current.bundle, ...imageState },
            }
          : current,
      )

      if (imageState.fanImageStatus === 'ready') {
        showReadyStatusBriefly(slotId)
      }

      shouldRequestGeneration = shouldGenerateImmediately && Boolean(imageState.sourcePhotoUrl)
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Failed to upload participant photo.'
      setDraw((current) =>
        mergeBundleImageState(current, slotId, {
          fanImageStatus: 'failed',
          fanImageError: message,
        }),
      )
      setError(message)
    } finally {
      setImageOperation(slotId, null)
    }

    if (shouldRequestGeneration) {
      await requestFanImages(slotId, true)
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
        revealedBundle.fanImageStatus === 'idle' &&
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
            {claimedBundles.map((bundle) => {
              const imageOperation = getImageOperation(bundle.slotId)
              const isReadyStatusTransient = bundle.fanImageStatus === 'ready' && Boolean(recentlyReadyPhotos[bundle.slotId])
              const photoStatus = bundlePhotoStatus(bundle, imageOperation, isReadyStatusTransient)
              const bundleMood = allocationDisplayState.bundleMoodBySlotId[bundle.slotId] ?? 'neutral'
              const previewImage = getBundlePreviewImage(bundle, bundleMood)
              const displayedTeams = displayedTeamsBySlotId[bundle.slotId] ?? bundle.teams

              return (
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
                      {previewImage ? (
                        <button
                          type="button"
                          className="bundle-photo-preview"
                          aria-label="View AI profile photo"
                          onClick={() =>
                            {
                              setActivePhotoFrameIndex(0)
                              setActivePhotoPreview({
                                bundle,
                              })
                            }
                          }
                        >
                          <img src={previewImage.imageUrl} alt="" />
                        </button>
                      ) : null}
                      {!bundle.sourcePhotoUrl ? (
                        <label className={`bundle-photo-button ${isImageBusy(bundle.slotId) ? 'is-disabled' : ''}`}>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.heic,.heif,.heics,.heifs"
                            disabled={isImageBusy(bundle.slotId)}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0]

                              if (file) {
                                void uploadParticipantPhoto(bundle.slotId, file, bundle.isRevealed)
                              }

                              event.currentTarget.value = ''
                            }}
                          />
                          <span>Add photo</span>
                        </label>
                      ) : null}
                    </div>
                  </header>

                  {photoStatus ? (
                    <div
                      className={`bundle-photo-status is-${imageOperation ?? bundle.fanImageStatus} ${
                        isReadyStatusTransient ? 'is-transient' : ''
                      }`}
                      aria-live="polite"
                    >
                      <p>{photoStatus}</p>
                      {bundle.sourcePhotoUrl && bundle.fanImageStatus === 'failed' && !imageOperation ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => void requestFanImages(bundle.slotId, true)}
                          disabled={isImageBusy(bundle.slotId)}
                        >
                          Retry
                        </button>
                      ) : null}
                      {bundle.sourcePhotoUrl &&
                      bundle.isRevealed &&
                      bundle.fanImageStatus === 'idle' &&
                      !imageOperation ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => void requestFanImages(bundle.slotId, true)}
                          disabled={isImageBusy(bundle.slotId)}
                        >
                          Generate
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {bundle.isRevealed ? (
                    <ul className="bundle-team-list">
                      {displayedTeams.map((team) => (
                        <li
                          key={team.name}
                          className={getBundleTeamRowClass(
                            team.rank,
                            Boolean(allocationDisplayState.teamsByName[normalizeTeamName(team.name)]?.isDimmed),
                          )}
                        >
                          <button
                            type="button"
                            className="bundle-team-button"
                            aria-label={`View ${team.name} team stats`}
                            onClick={() => {
                              setSelectedTeamDetail(
                                allocationDisplayState.teamDetailsByName[normalizeTeamName(team.name)] ?? null,
                              )
                            }}
                          >
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
                          </button>
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
              )
            })}
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

      {activePhotoPreview ? (
        <PlayerPhotoLightbox
          playerName={activePhotoPreview.bundle.playerName}
          currentFrame={currentPhotoFrame}
          frameIndex={activePhotoFrames.length ? activePhotoFrameIndex % activePhotoFrames.length : 0}
          frameCount={activePhotoFrames.length}
          nextMatchups={activePhotoNextMatchups}
          onClose={closePhotoPreview}
        />
      ) : null}

      {selectedTeamDetail ? <TeamDetailLightbox team={selectedTeamDetail} onClose={closeTeamDetail} /> : null}
    </main>
  )
}
