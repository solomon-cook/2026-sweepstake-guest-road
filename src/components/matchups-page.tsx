import { HeaderLinks } from '@/components/header-links'
import { MatchupCard } from '@/components/matchup-card'
import { PreviousMatchupsToggle } from '@/components/previous-matchups-toggle'
import type { MatchupView } from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000
const MATCHUP_TIME_ZONE = 'Europe/London'

type MatchupGroupId = 'yesterday' | 'today' | 'tomorrow' | 'future'

type MatchupGroup = {
  id: MatchupGroupId
  title: string
  matchups: MatchupView[]
}

function londonDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: MATCHUP_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

function isYesterdayMatchup(matchup: MatchupView, now: Date) {
  return londonDateKey(matchup.fixture.startsAt) === londonDateKey(new Date(now.getTime() - DAY_MS))
}

function buildMatchupGroups(matchups: MatchupView[], now: Date): MatchupGroup[] {
  const todayKey = londonDateKey(now)
  const yesterdayKey = londonDateKey(new Date(now.getTime() - DAY_MS))
  const tomorrowKey = londonDateKey(new Date(now.getTime() + DAY_MS))
  const groups: MatchupGroup[] = [
    { id: 'yesterday', title: 'Yesterday', matchups: [] },
    { id: 'today', title: 'Today', matchups: [] },
    { id: 'tomorrow', title: 'Tomorrow', matchups: [] },
    { id: 'future', title: 'Future matches', matchups: [] },
  ]
  const groupById = new Map(groups.map((group) => [group.id, group]))

  for (const matchup of matchups) {
    const fixtureDateKey = londonDateKey(matchup.fixture.startsAt)
    const groupId =
      fixtureDateKey === yesterdayKey
        ? 'yesterday'
        : fixtureDateKey === todayKey
          ? 'today'
          : fixtureDateKey === tomorrowKey
            ? 'tomorrow'
            : 'future'

    groupById.get(groupId)?.matchups.push(matchup)
  }

  return groups.filter((group) => group.matchups.length > 0)
}

function labelForMatchup(matchup: MatchupView) {
  if (matchup.fixture.status === 'live') {
    return 'Current match'
  }

  if (matchup.fixture.status === 'finished') {
    return 'Previous match'
  }

  return 'Upcoming match'
}

export function MatchupsPage({
  matchups,
  previousMatchups,
  warnings,
}: {
  matchups: MatchupView[]
  previousMatchups: MatchupView[]
  warnings: string[]
}) {
  const now = new Date()
  const yesterdayMatchups = previousMatchups.filter((matchup) => isYesterdayMatchup(matchup, now))
  const olderPreviousMatchups = previousMatchups.filter((matchup) => !isYesterdayMatchup(matchup, now))
  const groupedMatchups = buildMatchupGroups([...yesterdayMatchups, ...matchups], now)
  const hasGroupedMatchups = groupedMatchups.length > 0

  return (
    <main className="page-shell matchup-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Matchups</h1>
        </div>
        <HeaderLinks />
      </section>

      {warnings.length ? (
        <section className="matchup-warning" aria-label="Matchup warnings">
          {warnings.slice(0, 4).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}

      <section className="matchup-list" aria-label="Current and upcoming matchups">
        {hasGroupedMatchups ? (
          groupedMatchups.map((group) => (
            <section className="matchup-day-group" aria-label={`${group.title} matchups`} key={group.id}>
              <h2>{group.title}</h2>
              <div className="matchup-day-list">
                {group.matchups.map((matchup) => (
                  <MatchupCard
                    key={matchup.fixture.id}
                    matchup={matchup}
                    label={labelForMatchup(matchup)}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <article className="matchup-empty">
            <p className="section-kicker">No fixtures</p>
            <h2>No current or upcoming fixtures were returned.</h2>
            <p>Reload later once the free fixture sources publish the next World Cup matches.</p>
          </article>
        )}

        <PreviousMatchupsToggle matchups={olderPreviousMatchups} />
      </section>
    </main>
  )
}
