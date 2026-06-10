'use client'

import { useState } from 'react'
import { HeaderLinks } from '@/components/header-links'
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
  const [playerCount] = useState<PlayerCount>(initialDraw.playerCount)
  const [playerNames, setPlayerNames] = useState([
    ...initialDraw.allocation.bundles.map((bundle) => bundle.playerName),
    ...INITIAL_NAMES,
  ])
  const [draw, setDraw] = useState(initialDraw)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const visibleNames = playerNames.slice(0, playerCount)

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

          {error ? <p className="error-copy">{error}</p> : null}
        </div>
      </section>
    </main>
  )
}
