'use client'

import { type CSSProperties, useState } from 'react'
import { HeaderLinks } from '@/components/header-links'
import type {
  BracketMatchView,
  FormResult,
  GroupStandingView,
  LeaderboardData,
  PlayerLeaderboardRow,
  TeamOwnerView,
} from '@/lib/types'

type LeaderboardTab = 'groups' | 'players' | 'knockout'
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
  }).format(new Date(value))
}

function FormChip({ result }: { result: FormResult }) {
  const label = result === 'win' ? 'W' : result === 'draw' ? 'D' : result === 'loss' ? 'L' : ''

  return (
    <span className={`leaderboard-form-chip is-${result}`} aria-label={result === 'empty' ? 'No result' : result}>
      {label}
    </span>
  )
}

function OwnerIdentity({ owner }: { owner: TeamOwnerView }) {
  const photoUrl = ownerPhotoUrl(owner)

  return (
    <div className={`leaderboard-owner ${owner.isAssigned ? '' : 'is-unassigned'}`}>
      <span className="leaderboard-avatar">
        {photoUrl ? <img src={photoUrl} alt="" /> : <span>{initials(owner.ownerName)}</span>}
      </span>
      <span className="leaderboard-owner-copy">
        <strong>{owner.ownerName}</strong>
        <span>
          {owner.teamFlagImageUrl ? (
            <img src={owner.teamFlagImageUrl} alt={`${owner.teamName} flag`} width={22} height={16} />
          ) : null}
          {owner.teamName}
        </span>
      </span>
    </div>
  )
}

function formatAliveScore(value: number) {
  return value.toFixed(2)
}

function GroupRow({ standing }: { standing: GroupStandingView }) {
  const isEliteTeam = standing.position <= 2

  return (
    <tr className={isEliteTeam ? 'is-elite-team' : ''}>
      <td className="leaderboard-position">{standing.position}</td>
      <td className="leaderboard-team-cell">
        <OwnerIdentity owner={standing} />
        <div className="leaderboard-mobile-row-details">
          <div className="leaderboard-mobile-points">
            <strong>{standing.points}</strong>
            <span>Pts</span>
          </div>
          <div className="leaderboard-mobile-form">
            {standing.form.slice(0, 3).map((result, index) => (
              <FormChip key={`${standing.teamName}-mobile-${index}`} result={result} />
            ))}
          </div>
          <dl className="leaderboard-mobile-stats">
            <div>
              <dt>MP</dt>
              <dd>{standing.played}</dd>
            </div>
            <div>
              <dt>W</dt>
              <dd>{standing.won}</dd>
            </div>
            <div>
              <dt>D</dt>
              <dd>{standing.drawn}</dd>
            </div>
            <div>
              <dt>L</dt>
              <dd>{standing.lost}</dd>
            </div>
            <div>
              <dt>GD</dt>
              <dd>{standing.goalDifference}</dd>
            </div>
          </dl>
        </div>
      </td>
      <td>{standing.played}</td>
      <td>{standing.won}</td>
      <td>{standing.drawn}</td>
      <td>{standing.lost}</td>
      <td>{standing.goalsFor}</td>
      <td>{standing.goalsAgainst}</td>
      <td>{standing.goalDifference}</td>
      <td className="leaderboard-points">{standing.points}</td>
      <td>
        <div className="leaderboard-form">
          {standing.form.map((result, index) => (
            <FormChip key={`${standing.teamName}-${index}`} result={result} />
          ))}
        </div>
      </td>
    </tr>
  )
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
          {player.aliveTeamCount} alive of {player.totalTeamCount}
        </span>
      </span>
    </div>
  )
}

function PlayerRow({ player, position }: { player: PlayerLeaderboardRow; position: number }) {
  const isLeading = position <= 2

  return (
    <tr className={isLeading ? 'is-elite-team' : ''}>
      <td className="leaderboard-position">{position}</td>
      <td className="leaderboard-player-cell">
        <PlayerIdentity player={player} />
        <div className="leaderboard-mobile-row-details leaderboard-mobile-row-details--players">
          <div className="leaderboard-mobile-points">
            <strong>{player.aliveTeamCount}</strong>
            <span>Alive</span>
          </div>
          <div className="leaderboard-player-mobile-score">
            <strong>{formatAliveScore(player.aliveScoreTotal)}</strong>
            <span>Alive score</span>
          </div>
          <div className="leaderboard-player-chip-list">
            {player.teams.map((team) => (
              <span
                key={`${player.slotId}-${team.teamName}`}
                className={`leaderboard-player-chip ${team.isAlive ? 'is-alive' : 'is-out'}`}
              >
                {team.teamFlagImageUrl ? <img src={team.teamFlagImageUrl} alt="" width={18} height={13} /> : null}
                {team.teamName}
              </span>
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
            <span
              key={`${player.slotId}-desktop-${team.teamName}`}
              className={`leaderboard-player-chip ${team.isAlive ? 'is-alive' : 'is-out'}`}
              title={`${team.teamName}${team.teamRank ? ` (#${team.teamRank})` : ''}`}
            >
              {team.teamFlagImageUrl ? <img src={team.teamFlagImageUrl} alt="" width={18} height={13} /> : null}
              {team.teamName}
            </span>
          ))}
        </div>
      </td>
    </tr>
  )
}

function GroupStageView({ data }: { data: LeaderboardData }) {
  return (
    <section className="leaderboard-groups" aria-label="Group stage leaderboard">
      {data.groups.map((group) => (
        <article key={group.group} className="leaderboard-group">
          <h2>Group {group.group}</h2>
          <div className="leaderboard-table-scroll">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th aria-label="Position" />
                  <th>Owner / Team</th>
                  <th>MP</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th>Pts</th>
                  <th>Last 5</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((standing) => (
                  <GroupRow key={standing.teamName} standing={standing} />
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  )
}

function PlayerLeaderboardView({ data }: { data: LeaderboardData }) {
  if (!data.players.length) {
    return (
      <section className="leaderboard-empty">
        <p className="section-kicker">Players</p>
        <h2>No players have claimed a bundle yet.</h2>
      </section>
    )
  }

  return (
    <section className="leaderboard-groups" aria-label="Player leaderboard">
      <article className="leaderboard-group">
        <h2>Players</h2>
        <div className="leaderboard-table-scroll">
          <table className="leaderboard-table leaderboard-player-table">
            <thead>
              <tr>
                <th aria-label="Position" />
                <th>Player</th>
                <th>Alive</th>
                <th>Out</th>
                <th>Alive Score</th>
                <th>Best Alive</th>
                <th>Teams</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((player, index) => (
                <PlayerRow key={player.slotId} player={player} position={index + 1} />
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

function BracketEntrant({ side, score }: { side: TeamOwnerView; score?: number | null }) {
  const photoUrl = ownerPhotoUrl(side)
  const code = teamCode(side)

  return (
    <div className={`leaderboard-bracket-entrant ${side.isAssigned ? '' : 'is-tbd'}`}>
      <span className="leaderboard-bracket-photo">
        {photoUrl ? <img src={photoUrl} alt="" /> : <span>{code === 'TBD' ? 'T' : code.slice(0, 1)}</span>}
      </span>
      <strong>{code}</strong>
      {typeof score === 'number' ? <strong>{score}</strong> : null}
    </div>
  )
}

function CompactBracketMatch({
  match,
  className = '',
  style,
}: {
  match: BracketMatchView
  className?: string
  style?: CSSProperties
}) {
  return (
    <article className={`leaderboard-bracket-card ${className}`} style={style}>
      <div className="leaderboard-bracket-entrants">
        <BracketEntrant side={match.home} score={match.homeScore} />
        <BracketEntrant side={match.away} score={match.awayScore} />
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
}: {
  rounds: Map<string, BracketMatchView[]>
  side: 'left' | 'right'
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

function DesktopBracket({ rounds }: { rounds: Map<string, BracketMatchView[]> }) {
  const final = rounds.get('Final')?.[0] ?? null

  return (
    <section className="leaderboard-bracket-desktop" aria-label="Knockout stage bracket">
      <BracketWing rounds={rounds} side="left" />
      <div className="leaderboard-bracket-center">
        <ChampionMark />
        {final ? <CompactBracketMatch match={final} className="is-final" /> : null}
      </div>
      <BracketWing rounds={rounds} side="right" />
    </section>
  )
}

function MobileBracket({ rounds }: { rounds: Map<string, BracketMatchView[]> }) {
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
          <CompactBracketMatch key={match.id} match={match} className={`is-mobile-${slot}`} />
        ))}
        <ChampionMark />
      </div>
    </section>
  )
}

function KnockoutView({ data }: { data: LeaderboardData }) {
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
      <DesktopBracket rounds={rounds} />
      <MobileBracket rounds={rounds} />
    </>
  )
}

export function LeaderboardPage({ data }: { data: LeaderboardData }) {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('groups')

  return (
    <main className="page-shell leaderboard-shell">
      <section className="top-bar leaderboard-top-bar">
        <div>
          <p className="eyebrow">Guest Road 2026 World Cup Sweepstake</p>
          <h1>Leaderboard</h1>
        </div>
        <HeaderLinks />
      </section>

      {data.warnings.length ? (
        <section className="matchup-warning" aria-label="Leaderboard warnings">
          {data.warnings.slice(0, 4).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}

      <section className="leaderboard-panel">
        <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'groups'}
            className={activeTab === 'groups' ? 'is-active' : ''}
            onClick={() => setActiveTab('groups')}
          >
            Group Stage
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'players'}
            className={activeTab === 'players' ? 'is-active' : ''}
            onClick={() => setActiveTab('players')}
          >
            Players
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'knockout'}
            className={activeTab === 'knockout' ? 'is-active' : ''}
            onClick={() => setActiveTab('knockout')}
          >
            Knockout Stage
          </button>
        </div>

        {activeTab === 'groups' ? <GroupStageView data={data} /> : null}
        {activeTab === 'players' ? <PlayerLeaderboardView data={data} /> : null}
        {activeTab === 'knockout' ? <KnockoutView data={data} /> : null}
      </section>
    </main>
  )
}
