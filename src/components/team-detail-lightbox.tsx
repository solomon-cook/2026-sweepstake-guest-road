'use client'

import type { AllocationTeamDetail, AllocationTeamFixtureSummary } from '@/lib/allocation-status'

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

function formatGoalDifference(value: number) {
  return value > 0 ? `+${value}` : String(value)
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

function formatTeamStatus(status: AllocationTeamDetail['status']) {
  if (status === 'alive') {
    return 'Still alive'
  }

  if (status === 'out') {
    return 'Eliminated'
  }

  return 'Pending'
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

export function TeamDetailLightbox({
  team,
  onClose,
}: {
  team: AllocationTeamDetail
  onClose: () => void
}) {
  return (
    <div
      className="photo-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-lightbox-title"
      onClick={onClose}
    >
      <div className="photo-lightbox team-lightbox" onClick={(event) => event.stopPropagation()}>
        <div className="photo-lightbox-header team-lightbox-header">
          <div className="team-lightbox-title-row">
            {team.teamFlagImageUrl ? (
              <img src={team.teamFlagImageUrl} alt={`${team.teamName} flag`} width={48} height={36} />
            ) : null}
            <div>
              <p className="section-kicker">
                {formatTeamStatus(team.status)} · #{team.rank} seed
              </p>
              <h2 id="team-lightbox-title">{team.teamName}</h2>
            </div>
          </div>
          <button type="button" className="photo-lightbox-close" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="team-stat-grid">
          <div>
            <dt>Record</dt>
            <dd>
              {team.won}-{team.drawn}-{team.lost}
            </dd>
          </div>
          <div>
            <dt>Goals for</dt>
            <dd>{team.goalsFor}</dd>
          </div>
          <div>
            <dt>Goals against</dt>
            <dd>{team.goalsAgainst}</dd>
          </div>
          <div>
            <dt>Goal diff</dt>
            <dd>{formatGoalDifference(team.goalDifference)}</dd>
          </div>
          <div>
            <dt>Points</dt>
            <dd>{team.points}</dd>
          </div>
        </dl>

        <section className="team-lightbox-section">
          <div className="team-lightbox-section-heading">
            <p className="section-kicker">Next matchup</p>
          </div>
          {team.nextMatchup ? (
            <TeamMatchupRow matchup={team.nextMatchup} label={formatMatchTime(team.nextMatchup.startsAt)} />
          ) : (
            <p className="team-lightbox-empty">No next matchup found.</p>
          )}
        </section>

        <section className="team-lightbox-section">
          <div className="team-lightbox-section-heading">
            <p className="section-kicker">Last matchups</p>
          </div>
          {team.previousMatchups.length ? (
            <div className="team-matchup-list">
              {team.previousMatchups.map((matchup) => (
                <TeamMatchupRow key={matchup.id} matchup={matchup} />
              ))}
            </div>
          ) : (
            <p className="team-lightbox-empty">No last matchups found.</p>
          )}
        </section>
      </div>
    </div>
  )
}
