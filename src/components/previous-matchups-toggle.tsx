'use client'

import { useState } from 'react'

import { MatchupCard } from '@/components/matchup-card'
import type { MatchupView } from '@/lib/types'

const LOAD_PREVIOUS_MATCHES_BATCH = 4

export function PreviousMatchupsToggle({ matchups }: { matchups: MatchupView[] }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const visibleMatchups = matchups.slice(0, visibleCount)
  const hasMore = visibleCount < matchups.length

  return (
    <>
      {matchups.length > 0 && hasMore ? (
        <button
          className="secondary-button previous-matchups-trigger"
          type="button"
          onClick={() => setVisibleCount((count) => count + LOAD_PREVIOUS_MATCHES_BATCH)}
        >
          {visibleCount ? 'Load more previous matches' : 'Load previous matches'}
        </button>
      ) : null}

      {visibleMatchups.length ? (
        <div className="previous-matchups-panel">
          {visibleMatchups.map((matchup) => (
            <MatchupCard key={matchup.fixture.id} matchup={matchup} label="Previous match" />
          ))}
        </div>
      ) : null}
    </>
  )
}
