'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { SCORE_SNAPSHOT } from '@/lib/team-source'
import type { PersistedBundle, PersistedDraw, PlayerCount, TeamScore } from '@/lib/types'

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

type RevealPhase = 'closed' | 'confirm' | 'opening' | 'cards' | 'finishing'
type RevealCardView = {
  originalIndex: number
  sceneIndex: number
  team: TeamScore
}

const REVEAL_LAYOUTS = {
  5: [
    { x: -26, y: -22, rotate: -10, z: 3 },
    { x: 0, y: -34, rotate: 0, z: 4 },
    { x: 26, y: -20, rotate: 10, z: 3 },
    { x: -14, y: 22, rotate: -6, z: 2 },
    { x: 17, y: 20, rotate: 7, z: 2 },
  ],
  6: [
    { x: -28, y: -24, rotate: -10, z: 3 },
    { x: 0, y: -36, rotate: 0, z: 4 },
    { x: 28, y: -22, rotate: 11, z: 3 },
    { x: -28, y: 18, rotate: -8, z: 2 },
    { x: 0, y: 26, rotate: 0, z: 1 },
    { x: 28, y: 18, rotate: 8, z: 2 },
  ],
  7: [
    { x: -31, y: -22, rotate: -12, z: 3 },
    { x: -7, y: -36, rotate: -4, z: 4 },
    { x: 19, y: -30, rotate: 7, z: 4 },
    { x: 34, y: -6, rotate: 13, z: 3 },
    { x: 21, y: 23, rotate: 8, z: 2 },
    { x: -8, y: 28, rotate: -2, z: 1 },
    { x: -33, y: 14, rotate: -11, z: 2 },
  ],
} as const

function formatScore(value: number) {
  return value.toFixed(2)
}

function formatProbability(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

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
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('closed')
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [flippedCards, setFlippedCards] = useState<number[]>([])
  const [isPersistingReveal, setIsPersistingReveal] = useState(false)
  const timeoutIds = useRef<number[]>([])

  const allocation = draw.allocation
  const metrics = allocation
  const visibleNames = playerNames.slice(0, playerCount)
  const topTeams = teamScores.slice(0, 12)
  const rankedBundles = [...allocation.bundles].sort(
    (left, right) =>
      right.totalScore - left.totalScore || left.playerName.localeCompare(right.playerName),
  )
  const activeBundle = rankedBundles.find((bundle) => bundle.slotId === activeSlotId) ?? null
  const revealCards = activeBundle ? buildRevealCards(activeBundle) : []
  const revealLayout = getRevealLayout(revealCards.length)

  useEffect(() => {
    return () => {
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

  function startReveal(bundle: PersistedBundle) {
    if (bundle.isRevealed || isSaving || isPersistingReveal) {
      return
    }

    clearRevealTimers()
    setError('')
    setActiveSlotId(bundle.slotId)
    setFlippedCards([])
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

  function handleCardFlip(bundle: PersistedBundle, cardIndex: number) {
    if (revealPhase !== 'cards' || isPersistingReveal || flippedCards.includes(cardIndex)) {
      return
    }

    const nextFlippedCards = [...flippedCards, cardIndex]
    setFlippedCards(nextFlippedCards)

    if (isBundleFullyFlipped(bundle, nextFlippedCards)) {
      void persistRevealCompletion(bundle)
    }
  }

  return (
    <main className="page-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Players and bundles</h1>
        </div>
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
                <div>
                  <p>{bundle.playerName}</p>
                  <h3>{formatScore(bundle.totalScore)}</h3>
                </div>
                <span>{bundle.teams.length} teams</span>
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
                  <div className="bundle-pack-preview" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>Teams stay hidden until this player opens their pack.</p>
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
            <p className="sync-copy">Revealed teams stay visible across devices.</p>
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
              <p>Top 10 cards glow red. The rest of the top half glow blue.</p>
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

                    return (
                      <button
                        key={team.name}
                        type="button"
                        className={`team-reveal-card is-${glowTier} ${isFlipped ? 'is-flipped' : ''} ${
                          revealPhase === 'opening' ? 'is-launching' : ''
                        }`}
                        style={
                          {
                            '--card-x': `${layout.x}%`,
                            '--card-y': `${layout.y}%`,
                            '--card-rotate': `${layout.rotate}deg`,
                            '--card-z': layout.z,
                            '--card-delay': `${card.sceneIndex * 90}ms`,
                          } as CSSProperties
                        }
                        onClick={() => handleCardFlip(activeBundle, card.originalIndex)}
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
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}
