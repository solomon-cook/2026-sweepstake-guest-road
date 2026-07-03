'use client'

import type { AllocationTeamFixtureSummary } from '@/lib/allocation-status'
import type { PlayerNextMatchup, PlayerPhotoFrame } from '@/lib/player-photo-frames'

const MATCH_TIME_ZONE = 'Europe/London'

function formatMatchTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MATCH_TIME_ZONE,
  }).format(new Date(value))
}

function formatMatchScore(matchup: AllocationTeamFixtureSummary) {
  if (typeof matchup.teamScore !== 'number' || typeof matchup.opponentScore !== 'number') {
    return matchup.statusLabel
  }

  return `${matchup.teamScore} - ${matchup.opponentScore}`
}

function formatResultLabel(result: AllocationTeamFixtureSummary['result']) {
  if (result === 'pending') {
    return 'Next'
  }

  return result.charAt(0).toUpperCase()
}

function TeamMatchupRow({
  matchup,
  label,
}: {
  matchup: AllocationTeamFixtureSummary
  label?: string
}) {
  const detailLine = [matchup.round, matchup.venue].filter(Boolean).join(' · ')

  return (
    <article className={`team-matchup-row is-${matchup.result}`}>
      <div className="team-matchup-opponent">
        {matchup.opponentFlagImageUrl ? (
          <img src={matchup.opponentFlagImageUrl} alt="" width={24} height={18} />
        ) : null}
        <div>
          <p>
            {matchup.isHome ? 'vs' : '@'} {matchup.opponentName}
          </p>
          <span>{label ?? formatMatchTime(matchup.startsAt)}</span>
        </div>
      </div>
      <div className="team-matchup-score">
        <strong>{formatMatchScore(matchup)}</strong>
        <span>{formatResultLabel(matchup.result)}</span>
      </div>
      {detailLine ? <p className="team-matchup-detail">{detailLine}</p> : null}
    </article>
  )
}

export function PlayerPhotoLightbox({
  playerName,
  currentFrame,
  frameIndex,
  frameCount,
  nextMatchups,
  onClose,
}: {
  playerName: string
  currentFrame: PlayerPhotoFrame | null
  frameIndex: number
  frameCount: number
  nextMatchups: PlayerNextMatchup[]
  onClose: () => void
}) {
  return (
    <div
      className="photo-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-lightbox-title"
      onClick={onClose}
    >
      <div className="photo-lightbox player-photo-lightbox" onClick={(event) => event.stopPropagation()}>
        <div className="photo-lightbox-header">
          <div>
            <p className="section-kicker">Profile photo</p>
            <h2 id="photo-lightbox-title">{playerName}</h2>
          </div>
          <button type="button" className="photo-lightbox-close" onClick={onClose}>
            Close
          </button>
        </div>

        {currentFrame ? (
          <>
            <div className="photo-lightbox-stage">
              <div key={currentFrame.imageUrl} className="photo-lightbox-frame">
                <img className="photo-lightbox-image" src={currentFrame.imageUrl} alt={currentFrame.imageLabel} />
              </div>
            </div>
            {frameCount > 1 ? (
              <div className="photo-lightbox-carousel-meta" aria-live="polite">
                <p>
                  <span className="photo-expression-chip">{currentFrame.expressionLabel}</span>
                  {frameIndex + 1} of {frameCount}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        <section className="team-lightbox-section">
          <div className="team-lightbox-section-heading">
            <p className="section-kicker">Next matchups</p>
          </div>
          {nextMatchups.length ? (
            <div className="player-matchup-list">
              {nextMatchups.map(({ teamName, teamFlagImageUrl, matchup }) => (
                <div key={`${teamName}-${matchup.id}`} className="player-matchup-card">
                  <div className="player-matchup-team">
                    {teamFlagImageUrl ? <img src={teamFlagImageUrl} alt={`${teamName} flag`} width={24} height={18} /> : null}
                    <strong>{teamName}</strong>
                  </div>
                  <TeamMatchupRow matchup={matchup} label={formatMatchTime(matchup.startsAt)} />
                </div>
              ))}
            </div>
          ) : (
            <p className="team-lightbox-empty">No next matchups found.</p>
          )}
        </section>
      </div>
    </div>
  )
}
