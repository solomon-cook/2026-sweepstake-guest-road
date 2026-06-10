'use client'

import type { CSSProperties, MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { CardResult, PrizeCard } from '@/lib/types'

export type CardPackPhase = 'idle' | 'opening' | 'revealing' | 'revealed' | 'error'

type RevealCardView = {
  originalIndex: number
  sceneIndex: number
  card: PrizeCard
}

type CardImpact = {
  x: number
  y: number
  sequence: number
}

type CardPackOpeningProps = {
  title: string
  subtitle?: string
  openPack: () => Promise<CardResult>
  onClose?: () => void
  onOpenStart?: () => void
  onReveal?: (result: CardResult) => void
  onError?: (error: Error) => void
}

function GuestRoadPackFace({ className = '' }: { className?: string }) {
  return (
    <span className={`guest-road-pack-face ${className}`.trim()}>
      <span className="pack-flare" />
      <span className="pack-logo">Guest Road</span>
    </span>
  )
}

const REVEAL_LAYOUTS = {
  2: [
    { x: -92, y: -28, rotate: -7, z: 2 },
    { x: 92, y: -28, rotate: 7, z: 2 },
  ],
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

function getGlowTier(rank?: number) {
  if (!rank || rank > 24) {
    return 'standard'
  }

  if (rank <= 10) {
    return 'great'
  }

  return 'good'
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647
  }

  return hash
}

function buildRevealCards(result: CardResult): RevealCardView[] {
  return result.cards
    .map((card, originalIndex) => ({
      originalIndex,
      sortKey: hashString(`${result.id}:${card.id}:${card.name}`),
      card,
    }))
    .sort((left, right) => left.sortKey - right.sortKey || left.card.name.localeCompare(right.card.name))
    .map(({ originalIndex, card }, sceneIndex) => ({
      originalIndex,
      sceneIndex,
      card,
    }))
}

function getRevealLayout(cardCount: number) {
  if (cardCount <= 2) {
    return REVEAL_LAYOUTS[2]
  }

  if (cardCount <= 5) {
    return REVEAL_LAYOUTS[5]
  }

  if (cardCount === 6) {
    return REVEAL_LAYOUTS[6]
  }

  return REVEAL_LAYOUTS[7]
}

export function CardPackOpening({
  title,
  subtitle,
  openPack,
  onClose,
  onOpenStart,
  onReveal,
  onError,
}: CardPackOpeningProps) {
  const [phase, setPhase] = useState<CardPackPhase>('idle')
  const [result, setResult] = useState<CardResult | null>(null)
  const [error, setError] = useState('')
  const [flippedCards, setFlippedCards] = useState<number[]>([])
  const [cardImpacts, setCardImpacts] = useState<Record<number, CardImpact>>({})
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [mobileRevealIndex, setMobileRevealIndex] = useState(0)
  const timeoutIds = useRef<number[]>([])

  const revealCards = result ? buildRevealCards(result) : []
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
      clearRevealTimers()
    }
  }, [])

  function clearRevealTimers() {
    for (const timeoutId of timeoutIds.current) {
      window.clearTimeout(timeoutId)
    }

    timeoutIds.current = []
  }

  function scheduleRevealStep(callback: () => void, delayMs: number) {
    const timeoutId = window.setTimeout(callback, delayMs)
    timeoutIds.current.push(timeoutId)
  }

  async function handleOpenPack() {
    if (phase === 'opening' || phase === 'revealing') {
      return
    }

    clearRevealTimers()
    setError('')
    setResult(null)
    setFlippedCards([])
    setCardImpacts({})
    setMobileRevealIndex(0)
    setPhase('opening')
    onOpenStart?.()

    try {
      // Security boundary: the trusted app/server decides which cards are in this pack.
      // The client animation only reveals the already-decided result returned here.
      const nextResult = await openPack()
      setResult(nextResult)
      scheduleRevealStep(() => {
        setPhase('revealing')
      }, 1150)
    } catch (nextError) {
      const normalizedError =
        nextError instanceof Error ? nextError : new Error('Failed to open pack.')
      setError(normalizedError.message)
      setPhase('error')
      onError?.(normalizedError)
    }
  }

  function finishReveal(nextFlippedCards: number[]) {
    if (!result || nextFlippedCards.length < result.cards.length) {
      return
    }

    setPhase('revealed')
    onReveal?.(result)
  }

  function handleCardFlip(event: MouseEvent<HTMLButtonElement>, cardIndex: number) {
    if (phase !== 'revealing' || flippedCards.includes(cardIndex)) {
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

    if (!isMobileViewport) {
      finishReveal(nextFlippedCards)
    }
  }

  function advanceMobileReveal() {
    if (!activeMobileRevealCard) {
      return
    }

    const isCurrentCardFlipped = flippedCards.includes(activeMobileRevealCard.originalIndex)

    if (!isCurrentCardFlipped) {
      return
    }

    const isLastCard = mobileRevealIndex >= revealCards.length - 1

    if (isLastCard) {
      finishReveal(flippedCards)
      return
    }

    setMobileRevealIndex((current) => current + 1)
  }

  function renderCard(cardView: RevealCardView, isMobile = false) {
    const card = cardView.card
    const isFlipped = flippedCards.includes(cardView.originalIndex)
    const glowTier = getGlowTier(card.rank)
    const layout = isMobile
      ? { x: 0, y: 0, rotate: 0, z: 1 }
      : revealLayout[cardView.sceneIndex] ?? revealLayout[revealLayout.length - 1]
    const impact = cardImpacts[cardView.originalIndex]
    const flipDuration = glowTier === 'great' ? '1380ms' : glowTier === 'good' ? '980ms' : '620ms'

    return (
      <button
        key={card.id}
        type="button"
        className={`team-reveal-card ${isMobile ? 'mobile-single-card' : ''} is-${glowTier} ${
          isFlipped ? 'is-flipped' : ''
        } ${phase === 'opening' ? 'is-launching' : ''}`}
        style={
          {
            '--card-x': `${layout.x}px`,
            '--card-y': `${layout.y}px`,
            '--card-rotate': `${layout.rotate}deg`,
            '--card-z': layout.z,
            '--card-delay': `${cardView.sceneIndex * 90}ms`,
            '--flip-duration': flipDuration,
            '--impact-x': `${impact?.x ?? 50}%`,
            '--impact-y': `${impact?.y ?? 50}%`,
            '--pattern-rotation': `${cardView.sceneIndex * 37}deg`,
            '--pattern-shift': `${(cardView.sceneIndex % 4) * 14}px`,
          } as CSSProperties
        }
        onClick={(event) => handleCardFlip(event, cardView.originalIndex)}
        disabled={isFlipped || phase !== 'revealing'}
      >
        <span className="team-reveal-card-inner">
          <span className="team-reveal-card-face team-reveal-card-back">
            <GuestRoadPackFace />
          </span>
          <span className="team-reveal-card-face team-reveal-card-front">
            <span className="card-rank">{card.rank ? `#${card.rank}` : card.imageLabel}</span>
            <span className="team-card-flag-frame">
              {card.flagImageUrl ? (
                <img
                  className="team-card-flag"
                  src={card.flagImageUrl}
                  alt={`${card.name} flag`}
                  width={96}
                  height={72}
                />
              ) : (
                <span className="team-card-flag team-card-flag-fallback" aria-hidden="true">
                  {card.flag}
                </span>
              )}
            </span>
            <strong>{card.name}</strong>
            <small>{card.imageLabel}</small>
            <dl>
              {card.metadata.map((item) => (
                <div key={`${card.id}-${item.label}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </span>
          {impact ? (
            <span
              key={`${card.id}-${impact.sequence}`}
              className={`card-impact-ripple is-${glowTier}`}
            />
          ) : null}
        </span>
      </button>
    )
  }

  return (
    <div className="cards-pane">
      <div className="cards-pane-heading">
        <p className="section-kicker">
          {phase === 'idle' || phase === 'error'
            ? 'Card pack'
            : phase === 'opening'
              ? 'Opening pack'
              : 'Reveal board'}
        </p>
        <h2 id="reveal-title">{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      {phase === 'idle' || phase === 'error' ? (
        <div className="pack-idle-stage">
          <button
            type="button"
            className="pack-shell pack-open-button"
            onClick={handleOpenPack}
            aria-label={`Reveal ${title}`}
          >
            <GuestRoadPackFace />
          </button>
          <div className="confirm-actions">
            <button type="button" className="reveal-button" onClick={handleOpenPack}>
              Reveal Teams
            </button>
            {onClose ? (
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
            ) : null}
          </div>
          {error ? <p className="error-copy">{error}</p> : null}
        </div>
      ) : null}

      {phase === 'opening' || phase === 'revealing' || phase === 'revealed' ? (
        <>
          {isMobileViewport && phase !== 'opening' && activeMobileRevealCard ? (
            <div className="mobile-reveal-stage">
              <p className="mobile-reveal-progress">
                Team {mobileRevealIndex + 1} of {revealCards.length}
              </p>

              {renderCard(activeMobileRevealCard, true)}

              <div className="mobile-reveal-controls">
                {phase === 'revealed' && onClose ? (
                  <button type="button" className="reveal-button" onClick={onClose}>
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    className="reveal-button"
                    onClick={advanceMobileReveal}
                    disabled={!flippedCards.includes(activeMobileRevealCard.originalIndex)}
                  >
                    {mobileRevealIndex >= revealCards.length - 1 ? 'Finish reveal' : 'Next team'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                className={`reveal-arena ${phase === 'opening' ? 'is-opening' : 'is-settled'} ${
                  phase === 'revealed' ? 'is-finishing' : ''
                }`}
              >
                <div className="arena-backdrop" aria-hidden="true" />
                <div className={`pack-shell arena-pack ${phase === 'opening' ? 'is-live' : 'is-spent'}`}>
                  <GuestRoadPackFace />
                </div>
                <div className="pack-burst" aria-hidden="true" />

                {revealCards.map((card) => renderCard(card))}

                {phase === 'revealed' && onClose ? (
                  <button
                    type="button"
                    className="center-finale center-finale-button"
                    onClick={onClose}
                    aria-label="Close pack opener"
                  >
                    Done
                  </button>
                ) : (
                  <div className="center-finale" aria-live="polite">
                    <span>{flippedCards.length}</span>
                    <small>
                      {phase === 'opening'
                        ? result
                          ? 'Opening pack...'
                          : 'Requesting pack...'
                        : `${Math.max((result?.cards.length ?? 0) - flippedCards.length, 0)} cards left`}
                    </small>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
