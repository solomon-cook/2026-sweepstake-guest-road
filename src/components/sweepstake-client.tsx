'use client'

import type { CSSProperties, MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { HeaderLinks } from '@/components/header-links'
import { formatProbability, formatScore } from '@/lib/formatters'
import type { PersistedBundle, PersistedDraw, PlayerCount, TeamScore } from '@/lib/types'

const PLAYER_OPTIONS: PlayerCount[] = [7, 8, 9]

type RevealPhase = 'closed' | 'confirm' | 'opening' | 'cards' | 'finishing'
type RevealCardView = {
  originalIndex: number
  sceneIndex: number
  team: TeamScore
}
type CardImpact = {
  x: number
  y: number
  sequence: number
}

const REVEAL_LAYOUTS = {
  5: [
    { x: -180, y: -128, rotate: -10, z: 3 },
    { x: 0, y: -208, rotate: 0, z: 4 },
    { x: 180, y: -128, rotate: 10, z: 3 },
    { x: -112, y: 116, rotate: -6, z: 2 },
    { x: 112, y: 116, rotate: 6, z: 2 },
  ],
  6: [
    { x: -196, y: -138, rotate: -10, z: 3 },
    { x: 0, y: -220, rotate: 0, z: 4 },
    { x: 196, y: -138, rotate: 11, z: 3 },
    { x: -194, y: 70, rotate: -8, z: 2 },
    { x: 0, y: 144, rotate: 0, z: 1 },
    { x: 194, y: 70, rotate: 8, z: 2 },
  ],
  7: [
    { x: -214, y: -126, rotate: -12, z: 3 },
    { x: -82, y: -224, rotate: -5, z: 4 },
    { x: 82, y: -224, rotate: 5, z: 4 },
    { x: 214, y: -126, rotate: 12, z: 3 },
    { x: 162, y: 92, rotate: 8, z: 2 },
    { x: 0, y: 156, rotate: 0, z: 1 },
    { x: -162, y: 92, rotate: -8, z: 2 },
  ],
} as const

function getGlowTier(rank: number) {
  if (rank <= 10) {
    return 'great'
  }

  if (rank <= 24) {
    return 'good'
  }

  return 'standard'
}

function isBundleFullyFlipped(bundle: PersistedBundle, flippedCards: number[]) {
  return bundle.teams.every((_, index) => flippedCards.includes(index))
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647
  }

  return hash
}

function buildRevealCards(bundle: PersistedBundle): RevealCardView[] {
  return bundle.teams
    .map((team, originalIndex) => ({
      originalIndex,
      sortKey: hashString(`${bundle.slotId}:${team.name}:${team.rank}`),
      team,
    }))
    .sort((left, right) => left.sortKey - right.sortKey || left.team.rank - right.team.rank)
    .map(({ originalIndex, team }, sceneIndex) => ({
      originalIndex,
      sceneIndex,
      team,
    }))
}

function getRevealLayout(cardCount: number) {
  if (cardCount <= 5) {
    return REVEAL_LAYOUTS[5]
  }

  if (cardCount === 6) {
    return REVEAL_LAYOUTS[6]
  }

  return REVEAL_LAYOUTS[7]
}

export function SweepstakeClient({
  initialDraw,
}: {
  initialDraw: PersistedDraw
}) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(initialDraw.playerCount)
  const [draw, setDraw] = useState(initialDraw)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('closed')
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [flippedCards, setFlippedCards] = useState<number[]>([])
  const [cardImpacts, setCardImpacts] = useState<Record<number, CardImpact>>({})
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [mobileRevealIndex, setMobileRevealIndex] = useState(0)
  const [isPersistingReveal, setIsPersistingReveal] = useState(false)
  const timeoutIds = useRef<number[]>([])

  const allocation = draw.allocation
  const rankedBundles = [...allocation.bundles].sort(
    (left, right) =>
      right.totalScore - left.totalScore || left.playerName.localeCompare(right.playerName),
  )
  const activeBundle = rankedBundles.find((bundle) => bundle.slotId === activeSlotId) ?? null
  const revealCards = activeBundle ? buildRevealCards(activeBundle) : []
  const revealLayout = getRevealLayout(revealCards.length)
  const activeMobileRevealCard = revealCards[mobileRevealIndex] ?? null

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 699px)')

    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    return () => {
      mediaQuery.removeEventListener('change', syncViewport)

      for (const timeoutId of timeoutIds.current) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  function clearRevealTimers() {
    for (const timeoutId of timeoutIds.current) {
      window.clearTimeout(timeoutId)
    }

    timeoutIds.current = []
  }

  function closeRevealFlow() {
    clearRevealTimers()
    setRevealPhase('closed')
    setActiveSlotId(null)
    setFlippedCards([])
    setCardImpacts({})
    setMobileRevealIndex(0)
    setIsPersistingReveal(false)
  }

  function scheduleRevealStep(callback: () => void, delayMs: number) {
    const timeoutId = window.setTimeout(callback, delayMs)
    timeoutIds.current.push(timeoutId)
  }

  async function loadDraw(nextPlayerCount: PlayerCount) {
    setIsSaving(true)
    setError('')
    closeRevealFlow()

    try {
      const resetReveals = nextPlayerCount !== playerCount ? '&resetReveals=1' : ''
      const response = await fetch(`/api/draw?playerCount=${nextPlayerCount}${resetReveals}`, {
        cache: 'no-store',
      })
      const nextDraw = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextDraw) {
        throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to load draw.')
      }

      setDraw(nextDraw)
      setPlayerCount(nextPlayerCount)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load draw.')
    } finally {
      setIsSaving(false)
    }
  }

  function startReveal(bundle: PersistedBundle) {
    if (bundle.isRevealed || isSaving || isPersistingReveal) {
      return
    }

    clearRevealTimers()
    setError('')
    setActiveSlotId(bundle.slotId)
    setFlippedCards([])
    setMobileRevealIndex(0)
    setRevealPhase('confirm')
  }

  function confirmReveal() {
    setRevealPhase('opening')
    clearRevealTimers()
    scheduleRevealStep(() => {
      setRevealPhase('cards')
    }, 1350)
  }

  async function persistRevealCompletion(bundle: PersistedBundle) {
    setIsPersistingReveal(true)
    setRevealPhase('finishing')
    setError('')

    try {
      const response = await fetch('/api/draw', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reveal-slot',
          playerCount,
          slotId: bundle.slotId,
        }),
      })
      const nextDraw = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextDraw) {
        throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to reveal teams.')
      }

      setDraw(nextDraw)
      scheduleRevealStep(() => {
        closeRevealFlow()
      }, 850)
    } catch (nextError) {
      setIsPersistingReveal(false)
      setRevealPhase('cards')
      setError(nextError instanceof Error ? nextError.message : 'Failed to reveal teams.')
    }
  }

  function handleCardFlip(
    event: MouseEvent<HTMLButtonElement>,
    bundle: PersistedBundle,
    cardIndex: number,
  ) {
    if (revealPhase !== 'cards' || isPersistingReveal || flippedCards.includes(cardIndex)) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100

    setCardImpacts((current) => ({
      ...current,
      [cardIndex]: {
        x,
        y,
        sequence: (current[cardIndex]?.sequence ?? 0) + 1,
      },
    }))

    const nextFlippedCards = [...flippedCards, cardIndex]
    setFlippedCards(nextFlippedCards)

    if (isBundleFullyFlipped(bundle, nextFlippedCards)) {
      if (!isMobileViewport) {
        void persistRevealCompletion(bundle)
      }
    }
  }

  function advanceMobileReveal() {
    if (!activeBundle || !activeMobileRevealCard) {
      return
    }

    const isCurrentCardFlipped = flippedCards.includes(activeMobileRevealCard.originalIndex)

    if (!isCurrentCardFlipped || isPersistingReveal) {
      return
    }

    const isLastCard = mobileRevealIndex >= revealCards.length - 1

    if (isLastCard) {
      void persistRevealCompletion(activeBundle)
      return
    }

    setMobileRevealIndex((current) => current + 1)
  }

  return (
    <main className="page-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Players and bundles</h1>
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

          <div className="count-switcher" aria-label="Player count">
            {PLAYER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={option === playerCount ? 'is-active' : ''}
                onClick={() => void loadDraw(option)}
                disabled={isSaving || isPersistingReveal}
              >
                {option} players
              </button>
            ))}
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
                        <span>{team.name}</span>
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
                    disabled={isSaving || isPersistingReveal}
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
          <div className={`reveal-modal reveal-phase-${revealPhase}`}>
            {revealPhase === 'confirm' ? (
              <div className="confirm-pane">
                <p className="section-kicker">Private reveal</p>
                <h2 id="reveal-title">Reveal {activeBundle.playerName}&rsquo;s teams?</h2>
                <p>This shows the teams for this player and keeps them visible from now on.</p>
                <div className="confirm-actions">
                  <button type="button" className="reveal-button" onClick={confirmReveal}>
                    Yes, I am &quot;{activeBundle.playerName}&quot;
                  </button>
                  <button type="button" className="secondary-button" onClick={closeRevealFlow}>
                    No
                  </button>
                </div>
              </div>
            ) : null}

            {revealPhase === 'opening' || revealPhase === 'cards' || revealPhase === 'finishing' ? (
              <div className="cards-pane">
                <div className="cards-pane-heading">
                  <p className="section-kicker">{revealPhase === 'opening' ? 'Pack opening' : 'Reveal board'}</p>
                  <h2 id="reveal-title">{activeBundle.playerName}&rsquo;s teams</h2>
                  <p>
                    {revealPhase === 'opening'
                      ? 'The pack bursts open and the cards drift into place.'
                      : 'Cards are shuffled before the reveal so the best teams are not grouped at the front.'}
                  </p>
                </div>

                {isMobileViewport && revealPhase !== 'opening' && activeMobileRevealCard ? (
                  <div className="mobile-reveal-stage">
                    <div className="mobile-reveal-status">
                      <span>
                        Card {mobileRevealIndex + 1} of {revealCards.length}
                      </span>
                      <strong>{flippedCards.length} revealed</strong>
                    </div>

                    {(() => {
                      const team = activeMobileRevealCard.team
                      const isFlipped = flippedCards.includes(activeMobileRevealCard.originalIndex)
                      const glowTier = getGlowTier(team.rank)
                      const impact = cardImpacts[activeMobileRevealCard.originalIndex]
                      const flipDuration =
                        glowTier === 'great' ? '1380ms' : glowTier === 'good' ? '980ms' : '620ms'

                      return (
                        <button
                          type="button"
                          className={`team-reveal-card mobile-single-card is-${glowTier} ${
                            isFlipped ? 'is-flipped' : ''
                          }`}
                          style={
                            {
                              '--card-x': '0px',
                              '--card-y': '0px',
                              '--card-rotate': '0deg',
                              '--card-z': 1,
                              '--flip-duration': flipDuration,
                              '--impact-x': `${impact?.x ?? 50}%`,
                              '--impact-y': `${impact?.y ?? 50}%`,
                            } as CSSProperties
                          }
                          onClick={(event) =>
                            handleCardFlip(event, activeBundle, activeMobileRevealCard.originalIndex)
                          }
                          disabled={isFlipped || isPersistingReveal || revealPhase !== 'cards'}
                        >
                          <span className="team-reveal-card-inner">
                            <span className="team-reveal-card-face team-reveal-card-back">
                              <span className="card-back-badge">World Cup</span>
                              <strong>Reveal</strong>
                              <small>Tap to flip</small>
                            </span>
                            <span className="team-reveal-card-face team-reveal-card-front">
                              <span className="card-rank">#{team.rank}</span>
                              <strong>{team.name}</strong>
                              <small>Group {team.group}</small>
                              <dl>
                                <div>
                                  <dt>Score</dt>
                                  <dd>{formatScore(team.score)}</dd>
                                </div>
                                <div>
                                  <dt>Odds</dt>
                                  <dd>+{team.odds}</dd>
                                </div>
                                <div>
                                  <dt>Implied</dt>
                                  <dd>{formatProbability(team.impliedProbability)}</dd>
                                </div>
                              </dl>
                            </span>
                            {impact ? (
                              <span
                                key={`${team.name}-${impact.sequence}`}
                                className={`card-impact-ripple is-${glowTier}`}
                              />
                            ) : null}
                          </span>
                        </button>
                      )
                    })()}

                    <div className="mobile-reveal-controls">
                      <p>
                        {isPersistingReveal
                          ? 'Locking in reveal...'
                          : flippedCards.includes(activeMobileRevealCard.originalIndex)
                            ? 'Take a look, then continue.'
                            : 'Tap the card to reveal this team.'}
                      </p>
                      <button
                        type="button"
                        className="reveal-button"
                        onClick={advanceMobileReveal}
                        disabled={
                          isPersistingReveal ||
                          !flippedCards.includes(activeMobileRevealCard.originalIndex)
                        }
                      >
                        {mobileRevealIndex >= revealCards.length - 1 ? 'Finish reveal' : 'Next card'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`reveal-arena ${revealPhase === 'opening' ? 'is-opening' : 'is-settled'} ${
                      revealPhase === 'finishing' ? 'is-finishing' : ''
                    }`}
                  >
                    <div className="arena-backdrop" aria-hidden="true" />
                    <div className="arena-energy-ring" aria-hidden="true" />
                    <div className="arena-energy-core" aria-hidden="true" />
                    <div className={`pack-shell arena-pack ${revealPhase === 'opening' ? 'is-live' : 'is-spent'}`}>
                      <div className="pack-flare" />
                      <div className="pack-logo">Guest Road</div>
                    </div>
                    <div className="pack-burst" aria-hidden="true" />

                    {revealCards.map((card) => {
                      const team = card.team
                      const isFlipped = flippedCards.includes(card.originalIndex)
                      const glowTier = getGlowTier(team.rank)
                      const layout = revealLayout[card.sceneIndex] ?? revealLayout[revealLayout.length - 1]
                      const impact = cardImpacts[card.originalIndex]
                      const flipDuration =
                        glowTier === 'great' ? '1380ms' : glowTier === 'good' ? '980ms' : '620ms'

                      return (
                        <button
                          key={team.name}
                          type="button"
                          className={`team-reveal-card is-${glowTier} ${isFlipped ? 'is-flipped' : ''} ${
                            revealPhase === 'opening' ? 'is-launching' : ''
                          }`}
                          style={
                            {
                              '--card-x': `${layout.x}px`,
                              '--card-y': `${layout.y}px`,
                              '--card-rotate': `${layout.rotate}deg`,
                              '--card-z': layout.z,
                              '--card-delay': `${card.sceneIndex * 90}ms`,
                              '--flip-duration': flipDuration,
                              '--impact-x': `${impact?.x ?? 50}%`,
                              '--impact-y': `${impact?.y ?? 50}%`,
                              '--pattern-rotation': `${card.sceneIndex * 37}deg`,
                              '--pattern-shift': `${(card.sceneIndex % 4) * 14}px`,
                            } as CSSProperties
                          }
                          onClick={(event) => handleCardFlip(event, activeBundle, card.originalIndex)}
                          disabled={isFlipped || isPersistingReveal || revealPhase !== 'cards'}
                        >
                          <span className="team-reveal-card-inner">
                            <span className="team-reveal-card-face team-reveal-card-back">
                              <span className="card-back-badge">World Cup</span>
                              <strong>Reveal</strong>
                              <small>Click to flip</small>
                            </span>
                            <span className="team-reveal-card-face team-reveal-card-front">
                              <span className="card-rank">#{team.rank}</span>
                              <strong>{team.name}</strong>
                              <small>Group {team.group}</small>
                              <dl>
                                <div>
                                  <dt>Score</dt>
                                  <dd>{formatScore(team.score)}</dd>
                                </div>
                                <div>
                                  <dt>Odds</dt>
                                  <dd>+{team.odds}</dd>
                                </div>
                                <div>
                                  <dt>Implied</dt>
                                  <dd>{formatProbability(team.impliedProbability)}</dd>
                                </div>
                              </dl>
                            </span>
                            {impact ? (
                              <span
                                key={`${team.name}-${impact.sequence}`}
                                className={`card-impact-ripple is-${glowTier}`}
                              />
                            ) : null}
                          </span>
                        </button>
                      )
                    })}

                    <div className="center-finale">
                      <span>{flippedCards.length}</span>
                      <small>
                        {revealPhase === 'opening'
                          ? 'Opening pack...'
                          : isPersistingReveal
                            ? 'Locking in reveal...'
                            : `${activeBundle.teams.length - flippedCards.length} cards left`}
                      </small>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}
