import { selectMatchupOwnerPhoto } from '@/lib/matchups'
import type { MatchupSide, MatchupView } from '@/lib/types'

const MATCHUP_TIME_ZONE = 'Europe/London'

function formatMatchTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MATCHUP_TIME_ZONE,
  }).format(new Date(value))
}

function formatCompactMatchTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MATCHUP_TIME_ZONE,
  }).format(new Date(value))
}

function formatCompactMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: MATCHUP_TIME_ZONE,
  }).format(new Date(value))
}

function dateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: MATCHUP_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

function compactDateLabel(value: string, now = new Date()) {
  const matchDate = dateKey(value)
  const today = dateKey(now)
  const yesterday = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const tomorrow = dateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))

  if (matchDate === yesterday) {
    return 'Yesterday'
  }

  if (matchDate === today) {
    return 'Today'
  }

  if (matchDate === tomorrow) {
    return 'Tomorrow'
  }

  return formatCompactMatchDate(value)
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

function CompactMatchupSide({
  side,
  align,
  photoUrl,
  onSelectPlayer,
}: {
  side: MatchupSide
  align: 'home' | 'away'
  photoUrl: string | null
  onSelectPlayer?: (playerName: string) => void
}) {
  const ownerBlock = (
    <div className="compact-matchup-owner">
      {photoUrl && onSelectPlayer ? (
        <button
          type="button"
          className="compact-matchup-photo compact-matchup-photo-button"
          aria-label={`View ${side.ownerName} profile photos`}
          onClick={() => onSelectPlayer(side.ownerName)}
        >
          <img src={photoUrl} alt="" />
        </button>
      ) : (
        <div className="compact-matchup-photo">
          {photoUrl ? <img src={photoUrl} alt="" /> : <span>{initials(side)}</span>}
        </div>
      )}
      <p>{side.ownerName}</p>
    </div>
  )

  const teamBlock = (
    <div className="compact-matchup-team">
      <div className="compact-matchup-flag">
        {side.teamFlagImageUrl ? (
          <img src={side.teamFlagImageUrl} alt={`${side.teamName} flag`} width={96} height={72} />
        ) : (
          <span aria-hidden="true">Flag</span>
        )}
      </div>
      <h3>{side.teamName}</h3>
    </div>
  )

  return (
    <div className={`compact-matchup-side is-${align} ${side.isAssigned ? '' : 'is-unassigned'}`}>
      {align === 'away' ? teamBlock : ownerBlock}
      {align === 'away' ? ownerBlock : teamBlock}
    </div>
  )
}

export function MatchupCard({
  matchup,
  label,
  onSelectPlayer,
}: {
  matchup: MatchupView
  label: string
  onSelectPlayer?: (playerName: string) => void
}) {
  const isFinished = matchup.fixture.status === 'finished'
  const hasScore = matchup.fixture.homeScore !== null && matchup.fixture.awayScore !== null
  const compactShowsScore = matchup.fixture.status !== 'upcoming' && hasScore
  const compactDetail = compactShowsScore ? matchup.fixture.statusLabel : compactDateLabel(matchup.fixture.startsAt)
  const homeProbability = formatProbability(matchup.odds?.homeProbability)
  const awayProbability = formatProbability(matchup.odds?.awayProbability)
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
          {!isFinished ? <p className="section-kicker">{label}</p> : null}
          {!isFinished ? (
            <h2>
              {matchup.fixture.homeTeam} vs {matchup.fixture.awayTeam}
            </h2>
          ) : null}
        </div>
        {!isFinished ? (
          <div className="matchup-status">
            <strong>
              {hasScore
                ? `${matchup.fixture.homeScore} - ${matchup.fixture.awayScore}`
                : matchup.fixture.statusLabel}
            </strong>
            <span>{formatMatchTime(matchup.fixture.startsAt)}</span>
          </div>
        ) : null}
      </header>

      <div className="matchup-compact" aria-label={`${matchup.fixture.homeTeam} versus ${matchup.fixture.awayTeam}`}>
        <CompactMatchupSide side={matchup.home} align="home" photoUrl={homePhotoUrl} onSelectPlayer={onSelectPlayer} />
        <div className="compact-matchup-center">
          <span>{compactShowsScore ? 'Score' : 'Kickoff'}</span>
          <strong>
            {compactShowsScore
              ? `${matchup.fixture.homeScore} - ${matchup.fixture.awayScore}`
              : formatCompactMatchTime(matchup.fixture.startsAt)}
          </strong>
          <em>{compactDetail}</em>
        </div>
        <CompactMatchupSide side={matchup.away} align="away" photoUrl={awayPhotoUrl} onSelectPlayer={onSelectPlayer} />
      </div>

      {!isFinished ? (
        <footer className="matchup-card-footer">
          <p>{detailLine || 'Fixture details unavailable.'}</p>
          <p>
            {matchup.odds
              ? `Calculated chance: ${matchup.fixture.homeTeam} ${homeProbability}, ${matchup.fixture.awayTeam} ${awayProbability}.`
              : 'Calculated odds unavailable until both teams are matched to sweepstake scores.'}
          </p>
        </footer>
      ) : null}
    </article>
  )
}
