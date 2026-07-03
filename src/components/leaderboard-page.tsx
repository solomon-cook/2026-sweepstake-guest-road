'use client'

import dynamic from 'next/dynamic'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { HeaderLinks } from '@/components/header-links'
import {
  buildPlayerNextMatchups,
  buildPlayerPhotoFrames,
} from '@/lib/player-photo-frames'
import type { AllocationTeamDetail } from '@/lib/allocation-status'
import { normalizeTeamName } from '@/lib/matchups'
import type {
  BracketMatchView,
  LeaderboardData,
  PlayerLeaderboardRow,
  TeamSurvivalStatus,
  TeamOwnerView,
} from '@/lib/types'

const PlayerPhotoLightbox = dynamic(() =>
  import('@/components/player-photo-lightbox').then((module) => module.PlayerPhotoLightbox),
)
const TeamDetailLightbox = dynamic(() =>
  import('@/components/team-detail-lightbox').then((module) => module.TeamDetailLightbox),
)

const MATCH_TIME_ZONE = 'Europe/London'
const WING_ROUNDS = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals'] as const
const MOBILE_TREE_SLOTS = [
  'r16-top-1',
  'r16-top-2',
  'r16-top-3',
  'r16-top-4',
  'qf-top-left',
  'qf-top-right',
  'sf-top',
  'bronze',
  'final',
  'sf-bottom',
  'qf-bottom-left',
  'qf-bottom-right',
  'r16-bottom-1',
  'r16-bottom-2',
  'r16-bottom-3',
  'r16-bottom-4',
] as const

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toUpperCase() || '?'
  )
}

function ownerPhotoUrl(owner: TeamOwnerView) {
  return owner.ownerNeutralPhotoUrl || owner.ownerSourcePhotoUrl || null
}

function playerPhotoUrl(player: PlayerLeaderboardRow) {
  if (player.mood === 'ecstatic') {
    return player.ownerEcstaticPhotoUrl || player.ownerNeutralPhotoUrl || player.ownerSourcePhotoUrl || null
  }

  if (player.mood === 'devastated') {
    return player.ownerDevastatedPhotoUrl || player.ownerNeutralPhotoUrl || player.ownerSourcePhotoUrl || null
  }

  return player.ownerNeutralPhotoUrl || player.ownerSourcePhotoUrl || null
}

function teamCode(owner: TeamOwnerView) {
  const normalized = owner.teamName.trim()

  if (!normalized || normalized === 'TBD') {
    return 'TBD'
  }

  if (/^[0-9A-Z/]+$/i.test(normalized) && normalized.length <= 11) {
    return normalized.toUpperCase()
  }

  const words = normalized.split(/\s+/).filter(Boolean)

  if (words.length > 1) {
    return words
      .map((word) => Array.from(word)[0])
      .join('')
      .slice(0, 3)
      .toUpperCase()
  }

  return normalized.slice(0, 3).toUpperCase()
}

function formatMatchTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MATCH_TIME_ZONE,
  }).format(new Date(value))
}

function formatAliveScore(value: number) {
  return value.toFixed(2)
}

function playerChipClass(status: TeamSurvivalStatus) {
  return status === 'alive' ? 'is-alive' : status === 'pending' ? 'is-pending' : 'is-out'
}

function PlayerIdentity({ player }: { player: PlayerLeaderboardRow }) {
  const photoUrl = playerPhotoUrl(player)

  return (
    <div className="leaderboard-owner">
      <span className="leaderboard-avatar">
        {photoUrl ? <img src={photoUrl} alt="" /> : <span>{initials(player.playerName)}</span>}
      </span>
      <span className="leaderboard-owner-copy">
        <strong>{player.playerName}</strong>
        <span>
          {player.aliveTeamCount} currently through of {player.totalTeamCount}
        </span>
      </span>
    </div>
  )
}

function PlayerTeamChip({
  player,
  team,
  variant = '',
  onSelectTeam,
}: {
  player: PlayerLeaderboardRow
  team: PlayerLeaderboardRow['teams'][number]
  variant?: string
  onSelectTeam?: (teamName: string) => void
}) {
  const className = `leaderboard-player-chip ${playerChipClass(team.status)}`
  const title = `${team.teamName}${team.teamRank ? ` (#${team.teamRank})` : ''}`
  const keyPrefix = variant ? `${player.slotId}-${variant}` : player.slotId
  const content = (
    <>
      {team.teamFlagImageUrl ? <img src={team.teamFlagImageUrl} alt="" width={18} height={13} /> : null}
      {team.teamName}
    </>
  )

  if (onSelectTeam) {
    return (
      <button
        key={`${keyPrefix}-${team.teamName}`}
        type="button"
        className={className}
        title={title}
        aria-label={`View ${team.teamName} team stats`}
        onClick={() => onSelectTeam(team.teamName)}
      >
        {content}
      </button>
    )
  }

  return (
    <span key={`${keyPrefix}-${team.teamName}`} className={className} title={title}>
      {content}
    </span>
  )
}

function PlayerRow({
  player,
  position,
  onSelectTeam,
  onSelectPlayer,
}: {
  player: PlayerLeaderboardRow
  position: number
  onSelectTeam?: (teamName: string) => void
  onSelectPlayer?: (player: PlayerLeaderboardRow) => void
}) {
  const isLeading = position === 1
  const photoUrl = playerPhotoUrl(player)

  return (
    <tr className={isLeading ? 'is-elite-team' : ''}>
      <td className="leaderboard-position">{position}</td>
      <td className="leaderboard-player-cell">
        <div className="leaderboard-owner">
          {onSelectPlayer && photoUrl ? (
            <button
              type="button"
              className="leaderboard-avatar leaderboard-avatar-button"
              aria-label={`View ${player.playerName} profile photos`}
              onClick={() => onSelectPlayer(player)}
            >
              <img src={photoUrl} alt="" />
            </button>
          ) : (
            <PlayerIdentity player={player} />
          )}
          {onSelectPlayer && photoUrl ? (
            <span className="leaderboard-owner-copy">
              <strong>{player.playerName}</strong>
              <span>
                {player.aliveTeamCount} currently through of {player.totalTeamCount}
              </span>
            </span>
          ) : null}
        </div>
        <div className="leaderboard-mobile-row-details leaderboard-mobile-row-details--players">
          <dl className="leaderboard-player-mobile-stats">
            <div>
              <dt>Through</dt>
              <dd>{player.aliveTeamCount}</dd>
            </div>
            <div>
              <dt>Out</dt>
              <dd>{player.eliminatedTeamCount}</dd>
            </div>
            <div>
              <dt>Through Score</dt>
              <dd>{formatAliveScore(player.aliveScoreTotal)}</dd>
            </div>
            <div>
              <dt>Best Through</dt>
              <dd>{player.bestAliveTeamRank ? `#${player.bestAliveTeamRank}` : '-'}</dd>
            </div>
          </dl>
          <div className="leaderboard-player-chip-list">
            {player.teams.map((team) => (
              <PlayerTeamChip key={`${player.slotId}-${team.teamName}`} player={player} team={team} onSelectTeam={onSelectTeam} />
            ))}
          </div>
        </div>
      </td>
      <td className="leaderboard-player-count">{player.aliveTeamCount}</td>
      <td className="leaderboard-player-count">{player.eliminatedTeamCount}</td>
      <td className="leaderboard-points">{formatAliveScore(player.aliveScoreTotal)}</td>
      <td>{player.bestAliveTeamRank ? `#${player.bestAliveTeamRank}` : '-'}</td>
      <td>
        <div className="leaderboard-player-chip-list">
          {player.teams.map((team) => (
            <PlayerTeamChip
              key={`${player.slotId}-desktop-${team.teamName}`}
              player={player}
              team={team}
              variant="desktop"
              onSelectTeam={onSelectTeam}
            />
          ))}
        </div>
      </td>
    </tr>
  )
}

export function PlayerLeaderboardView({
  data,
  teamDetailsByName,
}: {
  data: LeaderboardData
  teamDetailsByName?: Record<string, AllocationTeamDetail>
}) {
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<AllocationTeamDetail | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerLeaderboardRow | null>(null)
  const [activePhotoFrameIndex, setActivePhotoFrameIndex] = useState(0)
  const handleSelectTeam = teamDetailsByName
    ? (teamName: string) => {
        setSelectedTeamDetail(teamDetailsByName[normalizeTeamName(teamName)] ?? null)
      }
    : undefined
  const activePhotoFrames = useMemo(
    () =>
      selectedPlayer
        ? buildPlayerPhotoFrames({
            playerName: selectedPlayer.playerName,
            sourcePhotoUrl: selectedPlayer.ownerSourcePhotoUrl,
            neutralPhotoUrl: selectedPlayer.ownerNeutralPhotoUrl,
            ecstaticPhotoUrl: selectedPlayer.ownerEcstaticPhotoUrl,
            devastatedPhotoUrl: selectedPlayer.ownerDevastatedPhotoUrl,
          })
        : [],
    [selectedPlayer],
  )
  const currentPhotoFrame =
    activePhotoFrames.length > 0
      ? activePhotoFrames[activePhotoFrameIndex % activePhotoFrames.length]
      : null
  const nextMatchups = useMemo(
    () =>
      selectedPlayer && teamDetailsByName
        ? buildPlayerNextMatchups(
            selectedPlayer.teams.map((team) => ({
              teamName: team.teamName,
              teamFlagImageUrl: team.teamFlagImageUrl ?? null,
              teamRank: team.teamRank ?? null,
            })),
            teamDetailsByName,
          )
        : [],
    [selectedPlayer, teamDetailsByName],
  )

  useEffect(() => {
    if (!selectedPlayer || activePhotoFrames.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActivePhotoFrameIndex((current) => (current + 1) % activePhotoFrames.length)
    }, 1900)

    return () => window.clearInterval(timer)
  }, [activePhotoFrames.length, selectedPlayer])

  if (!data.players.length) {
    return (
      <section className="leaderboard-empty">
        <p className="section-kicker">Players</p>
        <h2>No players have claimed a bundle yet.</h2>
      </section>
    )
  }

  return (
    <>
      <section className="leaderboard-groups" aria-label="Player leaderboard">
        <article className="leaderboard-group">
          <h2>Leaderboard</h2>
          <div className="leaderboard-table-scroll">
            <table className="leaderboard-table leaderboard-player-table">
              <thead>
                <tr>
                  <th aria-label="Position" />
                  <th>Player</th>
                  <th>Through</th>
                  <th>Out</th>
                  <th>Through Score</th>
                  <th>Best Through</th>
                  <th>Teams</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((player, index) => (
                  <PlayerRow
                    key={player.slotId}
                    player={player}
                    position={index + 1}
                    onSelectTeam={handleSelectTeam}
                    onSelectPlayer={(nextPlayer) => {
                      setActivePhotoFrameIndex(0)
                      setSelectedPlayer(nextPlayer)
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      {selectedTeamDetail ? (
        <TeamDetailLightbox team={selectedTeamDetail} onClose={() => setSelectedTeamDetail(null)} />
      ) : null}
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
    </>
  )
}

function BracketEntrant({
  side,
  score,
  onSelectTeam,
}: {
  side: TeamOwnerView
  score?: number | null
  onSelectTeam?: (teamName: string) => void
}) {
  const photoUrl = ownerPhotoUrl(side)
  const code = teamCode(side)

  return (
    <div className={`leaderboard-bracket-entrant ${side.isAssigned ? '' : 'is-tbd'}`}>
      {onSelectTeam && photoUrl ? (
        <button
          type="button"
          className="leaderboard-bracket-photo leaderboard-bracket-photo-button"
          aria-label={`View ${side.teamName} team stats`}
          onClick={() => onSelectTeam(side.teamName)}
        >
          <img src={photoUrl} alt="" />
        </button>
      ) : (
        <span className="leaderboard-bracket-photo">
          {photoUrl ? <img src={photoUrl} alt="" /> : <span>{code === 'TBD' ? 'T' : code.slice(0, 1)}</span>}
        </span>
      )}
      <strong>{code}</strong>
      {typeof score === 'number' ? <strong>{score}</strong> : null}
    </div>
  )
}

function CompactBracketMatch({
  match,
  className = '',
  style,
  onSelectTeam,
}: {
  match: BracketMatchView
  className?: string
  style?: CSSProperties
  onSelectTeam?: (teamName: string) => void
}) {
  return (
    <article className={`leaderboard-bracket-card ${className}`} style={style}>
      <div className="leaderboard-bracket-entrants">
        <BracketEntrant side={match.home} score={match.homeScore} onSelectTeam={onSelectTeam} />
        <BracketEntrant side={match.away} score={match.awayScore} onSelectTeam={onSelectTeam} />
      </div>
      <time>{formatMatchTime(match.startsAt)}</time>
    </article>
  )
}

function splitRound(matches: BracketMatchView[]) {
  const midpoint = Math.ceil(matches.length / 2)

  return [matches.slice(0, midpoint), matches.slice(midpoint)] as const
}

function wingCardStyle(roundIndex: number, matchIndex: number, count: number) {
  const rowSpan = 16 / Math.max(1, count)
  const rowStart = Math.round(matchIndex * rowSpan + 1)

  return {
    '--bracket-column': roundIndex + 1,
    '--bracket-row': rowStart,
    '--bracket-row-span': rowSpan,
  } as CSSProperties
}

function BracketWing({
  rounds,
  side,
  onSelectTeam,
}: {
  rounds: Map<string, BracketMatchView[]>
  side: 'left' | 'right'
  onSelectTeam?: (teamName: string) => void
}) {
  return (
    <div className={`leaderboard-bracket-wing is-${side}`}>
      {WING_ROUNDS.map((round, roundIndex) => {
        const [leftMatches, rightMatches] = splitRound(rounds.get(round) ?? [])
        const matches = side === 'left' ? leftMatches : rightMatches
        const visualRoundIndex = side === 'left' ? roundIndex : WING_ROUNDS.length - roundIndex - 1

        return matches.map((match, matchIndex) => (
          <CompactBracketMatch
            key={match.id}
            match={match}
            className={`is-round-${roundIndex} ${
              matches.length > 1 && matchIndex % 2 === 0 ? 'is-pair-start' : ''
            }`}
            style={wingCardStyle(visualRoundIndex, matchIndex, matches.length)}
            onSelectTeam={onSelectTeam}
          />
        ))
      })}
    </div>
  )
}

function ChampionMark() {
  return (
    <div className="leaderboard-champion-mark" aria-hidden="true">
      <img className="leaderboard-trophy" src="/trophy.svg" alt="" />
      <strong>Champion</strong>
    </div>
  )
}

function DesktopBracket({
  rounds,
  onSelectTeam,
}: {
  rounds: Map<string, BracketMatchView[]>
  onSelectTeam?: (teamName: string) => void
}) {
  const final = rounds.get('Final')?.[0] ?? null

  return (
    <section className="leaderboard-bracket-desktop" aria-label="Knockout stage bracket">
      <BracketWing rounds={rounds} side="left" onSelectTeam={onSelectTeam} />
      <div className="leaderboard-bracket-center">
        <ChampionMark />
        {final ? <CompactBracketMatch match={final} className="is-final" onSelectTeam={onSelectTeam} /> : null}
      </div>
      <BracketWing rounds={rounds} side="right" onSelectTeam={onSelectTeam} />
    </section>
  )
}

function MobileBracket({
  rounds,
  onSelectTeam,
}: {
  rounds: Map<string, BracketMatchView[]>
  onSelectTeam?: (teamName: string) => void
}) {
  const roundOf16 = rounds.get('Round of 16') ?? []
  const quarterFinals = rounds.get('Quarter-finals') ?? []
  const semiFinals = rounds.get('Semi-finals') ?? []
  const final = rounds.get('Final')?.[0] ?? null
  const bronze = rounds.get('Third place')?.[0] ?? null
  const treeMatches: Array<{ match: BracketMatchView; slot: (typeof MOBILE_TREE_SLOTS)[number] }> = [
    ...roundOf16.slice(0, 4).map((match, index) => ({
      match,
      slot: MOBILE_TREE_SLOTS[index],
    })),
    ...quarterFinals.slice(0, 2).map((match, index) => ({
      match,
      slot: index === 0 ? 'qf-top-left' as const : 'qf-top-right' as const,
    })),
    ...(semiFinals[0] ? [{ match: semiFinals[0], slot: 'sf-top' as const }] : []),
    ...(bronze ? [{ match: bronze, slot: 'bronze' as const }] : []),
    ...(final ? [{ match: final, slot: 'final' as const }] : []),
    ...(semiFinals[1] ? [{ match: semiFinals[1], slot: 'sf-bottom' as const }] : []),
    ...quarterFinals.slice(2, 4).map((match, index) => ({
      match,
      slot: index === 0 ? 'qf-bottom-left' as const : 'qf-bottom-right' as const,
    })),
    ...roundOf16.slice(4, 8).map((match, index) => ({
      match,
      slot: MOBILE_TREE_SLOTS[index + 12],
    })),
  ]

  return (
    <section className="leaderboard-bracket-mobile" aria-label="Mobile knockout stage bracket">
      <div className="leaderboard-mobile-tree">
        <div className="leaderboard-mobile-connector is-top-r16-left" aria-hidden="true" />
        <div className="leaderboard-mobile-connector is-top-r16-right" aria-hidden="true" />
        <div className="leaderboard-mobile-connector is-top-qf" aria-hidden="true" />
        <div className="leaderboard-mobile-connector is-final-top" aria-hidden="true" />
        <div className="leaderboard-mobile-connector is-final-bottom" aria-hidden="true" />
        <div className="leaderboard-mobile-connector is-bottom-qf" aria-hidden="true" />
        <div className="leaderboard-mobile-connector is-bottom-r16-left" aria-hidden="true" />
        <div className="leaderboard-mobile-connector is-bottom-r16-right" aria-hidden="true" />
        {treeMatches.map(({ match, slot }) => (
          <CompactBracketMatch
            key={match.id}
            match={match}
            className={`is-mobile-${slot}`}
            onSelectTeam={onSelectTeam}
          />
        ))}
        <ChampionMark />
      </div>
    </section>
  )
}

function KnockoutView({
  data,
  onSelectTeam,
}: {
  data: LeaderboardData
  onSelectTeam?: (teamName: string) => void
}) {
  const rounds = new Map<string, BracketMatchView[]>()

  for (const match of data.bracket) {
    const round = rounds.get(match.round) ?? []
    round.push(match)
    rounds.set(match.round, round)
  }

  if (!data.bracket.length) {
    return (
      <section className="leaderboard-empty">
        <p className="section-kicker">Knockout stage</p>
        <h2>No knockout fixtures are available yet.</h2>
      </section>
    )
  }

  return (
    <>
      <DesktopBracket rounds={rounds} onSelectTeam={onSelectTeam} />
      <MobileBracket rounds={rounds} onSelectTeam={onSelectTeam} />
    </>
  )
}

function LeaderboardWarnings({ data, label }: { data: LeaderboardData; label: string }) {
  if (!data.warnings.length) {
    return null
  }

  return (
    <section className="matchup-warning" aria-label={`${label} warnings`}>
      {data.warnings.slice(0, 4).map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </section>
  )
}

function LeaderboardPageShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="page-shell leaderboard-shell">
      <section className="top-bar leaderboard-top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>{title}</h1>
        </div>
        <HeaderLinks />
      </section>
      {children}
    </main>
  )
}

export function HomePage({
  data,
  teamDetailsByName,
}: {
  data: LeaderboardData
  teamDetailsByName?: Record<string, AllocationTeamDetail>
}) {
  return (
    <LeaderboardPageShell title="Leaderboard">
      <LeaderboardWarnings data={data} label="Leaderboard" />
      <section className="leaderboard-panel leaderboard-panel--plain">
        <PlayerLeaderboardView data={data} teamDetailsByName={teamDetailsByName} />
      </section>
    </LeaderboardPageShell>
  )
}

export function TournamentPage({
  data,
  teamDetailsByName,
}: {
  data: LeaderboardData
  teamDetailsByName?: Record<string, AllocationTeamDetail>
}) {
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<AllocationTeamDetail | null>(null)
  const handleSelectTeam = teamDetailsByName
    ? (teamName: string) => {
        setSelectedTeamDetail(teamDetailsByName[normalizeTeamName(teamName)] ?? null)
      }
    : undefined

  return (
    <LeaderboardPageShell title="Tournament">
      <LeaderboardWarnings data={data} label="Tournament" />
      <section className="leaderboard-panel">
        <KnockoutView data={data} onSelectTeam={handleSelectTeam} />
      </section>
      {selectedTeamDetail ? (
        <TeamDetailLightbox team={selectedTeamDetail} onClose={() => setSelectedTeamDetail(null)} />
      ) : null}
    </LeaderboardPageShell>
  )
}
