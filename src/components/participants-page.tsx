'use client'

import { useState } from 'react'
import { HeaderLinks } from '@/components/header-links'
import { MAX_PLAYER_COUNT, MIN_PLAYER_COUNT, PLAYER_COUNT_COOKIE } from '@/lib/player-count'
import type { PersistedDraw, PlayerCount } from '@/lib/types'

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

export function ParticipantsPage({ initialDraw }: { initialDraw: PersistedDraw }) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(initialDraw.playerCount)
  const [playerNames, setPlayerNames] = useState([
    ...initialDraw.allocation.bundles.map((bundle) => bundle.playerName),
    ...INITIAL_NAMES,
  ])
  const [draw, setDraw] = useState(initialDraw)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const visibleNames = playerNames.slice(0, playerCount)
  const canRemovePlayer = playerCount > MIN_PLAYER_COUNT
  const canAddPlayer = playerCount < MAX_PLAYER_COUNT

  function namesFromDraw(nextDraw: PersistedDraw) {
    return [
      ...nextDraw.allocation.bundles.map((bundle) => bundle.playerName),
      ...INITIAL_NAMES,
    ]
  }

  function rememberPlayerCount(nextPlayerCount: PlayerCount) {
    document.cookie = `${PLAYER_COUNT_COOKIE}=${nextPlayerCount}; path=/; max-age=31536000; SameSite=Lax`
  }

  async function persistNames(names = visibleNames, count = playerCount) {
    const response = await fetch('/api/draw', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerCount: count,
        names,
      }),
    })
    const nextDraw = (await response.json()) as PersistedDraw | { error: string }

    if (!response.ok || 'error' in nextDraw) {
      throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to save names.')
    }

    return nextDraw
  }

  async function loadDraw(nextPlayerCount: PlayerCount, resetReveals = false) {
    const resetQuery = resetReveals ? '&resetReveals=1' : ''
    const response = await fetch(`/api/draw?playerCount=${nextPlayerCount}${resetQuery}`, {
      cache: 'no-store',
    })
    const nextDraw = (await response.json()) as PersistedDraw | { error: string }

    if (!response.ok || 'error' in nextDraw) {
      throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to load draw.')
    }

    return nextDraw
  }

  async function changePlayerCount(nextPlayerCount: PlayerCount) {
    setIsSaving(true)
    setError('')

    try {
      const currentNames = visibleNames
      await persistNames(currentNames, playerCount)

      const loadedDraw = await loadDraw(nextPlayerCount, true)
      const loadedNames = loadedDraw.allocation.bundles.map((bundle) => bundle.playerName)
      const carriedNames = Array.from({ length: nextPlayerCount }, (_, index) =>
        currentNames[index] ?? loadedNames[index] ?? '',
      )
      const nextDraw = await persistNames(carriedNames, nextPlayerCount)

      setDraw(nextDraw)
      setPlayerCount(nextPlayerCount)
      setPlayerNames(namesFromDraw(nextDraw))
      rememberPlayerCount(nextPlayerCount)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to change player count.')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveNames() {
    setIsSaving(true)
    setError('')

    try {
      const nextDraw = await persistNames()
      setDraw(nextDraw)
      setPlayerNames(namesFromDraw(nextDraw))
      rememberPlayerCount(playerCount)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save names.')
    } finally {
      setIsSaving(false)
    }
  }

  async function redoTeams() {
    setIsSaving(true)
    setError('')

    try {
      await persistNames()

      const response = await fetch('/api/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerCount }),
      })
      const nextDraw = (await response.json()) as PersistedDraw | { error: string }

      if (!response.ok || 'error' in nextDraw) {
        throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to redo teams.')
      }

      setDraw(nextDraw)
      setPlayerNames(namesFromDraw(nextDraw))
      rememberPlayerCount(playerCount)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to redo teams.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Participants</h1>
        </div>
        <HeaderLinks />
      </section>

      <section className="details-panel">
        <div className="picker-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Participants</p>
              <h2>{playerCount} players</h2>
            </div>
            <p>
              Blank slots automatically fall back to <code>Player n</code>.
            </p>
          </div>

          <div className="participant-count-controls" aria-label="Player count controls">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void changePlayerCount((playerCount - 1) as PlayerCount)}
              disabled={isSaving || !canRemovePlayer}
            >
              Remove player
            </button>
            <span>{playerCount} active players</span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void changePlayerCount((playerCount + 1) as PlayerCount)}
              disabled={isSaving || !canAddPlayer}
            >
              Add player
            </button>
          </div>

          <div className="panel-actions">
            <button type="button" className="secondary-button" onClick={saveNames} disabled={isSaving}>
              Save names to shared draw
            </button>
            <p className="sync-copy">Revealed teams stay visible across devices.</p>
          </div>

          <div className="name-grid">
            {draw.allocation.bundles.slice(0, playerCount).map((_, index) => (
              <label key={index} className="name-field">
                <span>Slot {index + 1}</span>
                <input
                  value={visibleNames[index] ?? ''}
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

          <div className="redo-actions">
            <button type="button" className="secondary-button danger-button" onClick={redoTeams} disabled={isSaving}>
              Redo teams
            </button>
          </div>

          {error ? <p className="error-copy">{error}</p> : null}
        </div>
      </section>
    </main>
  )
}
