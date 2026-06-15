import { selectMatchupOwnerPhoto } from '@/lib/matchups'
import type { MatchupSide, MatchupView } from '@/lib/types'

function formatMatchTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}

function initials(side: MatchupSide) {
  return (
    side.ownerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toUpperCase() || '?'
  )
}

function formatProbability(value?: number | null) {
  return value ? `${Math.round(value * 100)}%` : '-'
}

function formatRank(value?: number | null) {
  return value ? `#${value}` : '-'
}

function formatGoals(value?: number | null) {
  if (typeof value !== 'number') {
    return '-'
  }

  return String(value)
}

function MatchupOwner({
  side,
  align,
  photoUrl,
}: {
  side: MatchupSide
  align: 'home' | 'away'
  photoUrl: string | null
}) {
  return (
    <div className={`matchup-owner is-${align} ${side.isAssigned ? '' : 'is-unassigned'}`}>
      <div className="matchup-photo">
        {photoUrl ? <img src={photoUrl} alt="" /> : <span>{initials(side)}</span>}
      </div>
      <p>{side.ownerName}</p>
    </div>
  )
}

function MatchupTeam({
  side,
  score,
  align,
}: {
  side: MatchupSide
  score?: number | null
  align: 'home' | 'away'
}) {
  return (
    <div className={`matchup-team is-${align}`}>
      <h2>{side.teamName}</h2>
      <div className="matchup-flag-frame">
        {side.teamFlagImageUrl ? (
          <img src={side.teamFlagImageUrl} alt={`${side.teamName} flag`} width={208} height={156} />
        ) : (
          <span aria-hidden="true">Flag</span>
        )}
      </div>
      <strong>{formatGoals(score)}</strong>
      <span>{score === 1 ? 'goal' : 'goals'}</span>
    </div>
  )
}

export function MatchupCard({ matchup, label }: { matchup: MatchupView; label: string }) {
  const hasScore = matchup.fixture.homeScore !== null && matchup.fixture.awayScore !== null
  const homeProbability = formatProbability(matchup.odds?.homeProbability)
  const awayProbability = formatProbability(matchup.odds?.awayProbability)
  const homeRank = formatRank(matchup.home.teamRank)
  const awayRank = formatRank(matchup.away.teamRank)
  const detailLine = [matchup.fixture.round, matchup.fixture.venue, matchup.odds?.source].filter(Boolean).join(' · ')
  const homePhotoUrl = selectMatchupOwnerPhoto(
    matchup.home,
    matchup.fixture.homeScore,
    matchup.fixture.awayScore,
  )
  const awayPhotoUrl = selectMatchupOwnerPhoto(
    matchup.away,
    matchup.fixture.awayScore,
    matchup.fixture.homeScore,
  )

  return (
    <article className={`matchup-card is-${matchup.fixture.status}`}>
      <header className="matchup-card-header">
        <div>
          <p className="section-kicker">{label}</p>
          <h2>
            {matchup.fixture.homeTeam} vs {matchup.fixture.awayTeam}
          </h2>
        </div>
        <div className="matchup-status">
          <strong>
            {hasScore
              ? `${matchup.fixture.homeScore} - ${matchup.fixture.awayScore}`
              : matchup.fixture.statusLabel}
          </strong>
          <span>{formatMatchTime(matchup.fixture.startsAt)}</span>
        </div>
      </header>

      <div className="versus-screen">
        <div className="versus-diagonal" aria-hidden="true" />

        <MatchupOwner side={matchup.home} align="home" photoUrl={homePhotoUrl} />
        <MatchupOwner side={matchup.away} align="away" photoUrl={awayPhotoUrl} />

        <p className="matchup-percentage is-home" aria-label={`${matchup.fixture.homeTeam} team rank`}>
          {homeRank}
        </p>
        <p className="matchup-percentage is-away" aria-label={`${matchup.fixture.awayTeam} team rank`}>
          {awayRank}
        </p>

        <div className="versus-teams">
          <MatchupTeam side={matchup.home} score={matchup.fixture.homeScore} align="home" />
          <div className="versus-mark" aria-hidden="true">
            <span>VS</span>
          </div>
          <MatchupTeam side={matchup.away} score={matchup.fixture.awayScore} align="away" />
        </div>
      </div>

      <footer className="matchup-card-footer">
        <p>{detailLine || 'Fixture details unavailable.'}</p>
        <p>
          {matchup.odds
            ? `Calculated chance: ${matchup.fixture.homeTeam} ${homeProbability}, ${matchup.fixture.awayTeam} ${awayProbability}.`
            : 'Calculated odds unavailable until both teams are matched to sweepstake scores.'}
        </p>
      </footer>
    </article>
  )
}
