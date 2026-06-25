'use client'

import { useEffect, useState } from 'react'
import { HeaderLinks } from '@/components/header-links'
import { MatchupCard } from '@/components/matchup-card'
import { PlayerPhotoLightbox, buildPlayerNextMatchups, buildPlayerPhotoFrames } from '@/components/player-photo-lightbox'
import { PreviousMatchupsToggle } from '@/components/previous-matchups-toggle'
import type { AllocationTeamDetail } from '@/lib/allocation-status'
import type { MatchupView, PlayerLeaderboardRow } from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000
const INITIAL_VISIBLE_MATCHUPS = 8
const LOAD_MORE_MATCHUPS_BATCH = 4
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
  players,
  teamDetailsByName,
}: {
  matchups: MatchupView[]
  previousMatchups: MatchupView[]
  warnings: string[]
  players: PlayerLeaderboardRow[]
  teamDetailsByName: Record<string, AllocationTeamDetail>
}) {
  const now = new Date()
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerLeaderboardRow | null>(null)
  const [activePhotoFrameIndex, setActivePhotoFrameIndex] = useState(0)
  const [visibleMatchupCount, setVisibleMatchupCount] = useState(INITIAL_VISIBLE_MATCHUPS)
  const yesterdayMatchups = previousMatchups.filter((matchup) => isYesterdayMatchup(matchup, now))
  const olderPreviousMatchups = previousMatchups.filter((matchup) => !isYesterdayMatchup(matchup, now))
  const visibleMatchups = matchups.slice(0, visibleMatchupCount)
  const groupedMatchups = buildMatchupGroups([...yesterdayMatchups, ...visibleMatchups], now)
  const hasGroupedMatchups = groupedMatchups.length > 0
  const hasMoreMatchups = visibleMatchupCount < matchups.length
  const playerByName = new Map(players.map((player) => [player.playerName, player]))
  const activePhotoFrames = selectedPlayer
    ? buildPlayerPhotoFrames({
        playerName: selectedPlayer.playerName,
        sourcePhotoUrl: selectedPlayer.ownerSourcePhotoUrl,
        neutralPhotoUrl: selectedPlayer.ownerNeutralPhotoUrl,
        ecstaticPhotoUrl: selectedPlayer.ownerEcstaticPhotoUrl,
        devastatedPhotoUrl: selectedPlayer.ownerDevastatedPhotoUrl,
      })
    : []
  const currentPhotoFrame =
    activePhotoFrames.length > 0
      ? activePhotoFrames[activePhotoFrameIndex % activePhotoFrames.length]
      : null
  const nextMatchups = selectedPlayer
    ? buildPlayerNextMatchups(
        selectedPlayer.teams.map((team) => ({
          teamName: team.teamName,
          teamFlagImageUrl: team.teamFlagImageUrl ?? null,
          teamRank: team.teamRank ?? null,
        })),
        teamDetailsByName,
      )
    : []

  useEffect(() => {
    if (!selectedPlayer || activePhotoFrames.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActivePhotoFrameIndex((current) => (current + 1) % activePhotoFrames.length)
    }, 1900)

    return () => window.clearInterval(timer)
  }, [activePhotoFrames.length, selectedPlayer])

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
        <PreviousMatchupsToggle
          matchups={olderPreviousMatchups}
          onSelectPlayer={(playerName) => {
            const nextPlayer = playerByName.get(playerName)

            if (!nextPlayer) {
              return
            }

            setActivePhotoFrameIndex(0)
            setSelectedPlayer(nextPlayer)
          }}
        />

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
                    onSelectPlayer={(playerName) => {
                      const nextPlayer = playerByName.get(playerName)

                      if (!nextPlayer) {
                        return
                      }

                      setActivePhotoFrameIndex(0)
                      setSelectedPlayer(nextPlayer)
                    }}
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

        {hasMoreMatchups ? (
          <button
            className="secondary-button matchup-list-trigger"
            type="button"
            onClick={() => setVisibleMatchupCount((count) => count + LOAD_MORE_MATCHUPS_BATCH)}
          >
            Load more matches
          </button>
        ) : null}
      </section>
      {selectedPlayer ? (
        <PlayerPhotoLightbox
          playerName={selectedPlayer.playerName}
          currentFrame={currentPhotoFrame}
          frameIndex={activePhotoFrames.length ? activePhotoFrameIndex % activePhotoFrames.length : 0}
          frameCount={activePhotoFrames.length}
          nextMatchups={nextMatchups}
          onClose={() => {
            setSelectedPlayer(null)
            setActivePhotoFrameIndex(0)
          }}
        />
      ) : null}
    </main>
  )
}
