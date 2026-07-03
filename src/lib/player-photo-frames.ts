import type { AllocationTeamDetail, AllocationTeamFixtureSummary } from './allocation-status'
import { normalizeTeamName } from './matchups'

export type PlayerPhotoFrame = {
  imageUrl: string
  imageLabel: string
  expressionLabel: string
}

export type PlayerNextMatchup = {
  teamName: string
  teamFlagImageUrl?: string | null
  teamRank?: number | null
  matchup: AllocationTeamFixtureSummary
}

export type PlayerPhotoSource = {
  playerName: string
  sourcePhotoUrl?: string | null
  neutralPhotoUrl?: string | null
  ecstaticPhotoUrl?: string | null
  devastatedPhotoUrl?: string | null
}

export type PlayerTeamReference = {
  teamName: string
  teamFlagImageUrl?: string | null
  teamRank?: number | null
}

export function buildPlayerPhotoFrames(source: PlayerPhotoSource): PlayerPhotoFrame[] {
  const frames: PlayerPhotoFrame[] = []

  if (source.neutralPhotoUrl) {
    frames.push({
      imageUrl: source.neutralPhotoUrl,
      imageLabel: `Neutral AI profile photo for ${source.playerName}`,
      expressionLabel: 'Calm',
    })
  }

  if (source.ecstaticPhotoUrl) {
    frames.push({
      imageUrl: source.ecstaticPhotoUrl,
      imageLabel: `Ecstatic AI profile photo for ${source.playerName}`,
      expressionLabel: 'Ecstatic',
    })
  }

  if (source.devastatedPhotoUrl) {
    frames.push({
      imageUrl: source.devastatedPhotoUrl,
      imageLabel: `Devastated AI profile photo for ${source.playerName}`,
      expressionLabel: 'Devastated',
    })
  }

  if (!frames.length && source.sourcePhotoUrl) {
    frames.push({
      imageUrl: source.sourcePhotoUrl,
      imageLabel: `Uploaded profile photo for ${source.playerName}`,
      expressionLabel: 'Original',
    })
  }

  return frames
}

export function buildPlayerNextMatchups(
  teams: PlayerTeamReference[],
  teamDetailsByName: Record<string, AllocationTeamDetail>,
): PlayerNextMatchup[] {
  return teams
    .flatMap((team) => {
      const detail = teamDetailsByName[normalizeTeamName(team.teamName)]

      if (!detail?.nextMatchup) {
        return []
      }

      return [
        {
          teamName: detail.teamName,
          teamFlagImageUrl: detail.teamFlagImageUrl ?? team.teamFlagImageUrl ?? null,
          teamRank: detail.rank ?? team.teamRank ?? null,
          matchup: detail.nextMatchup,
        },
      ]
    })
    .sort((left, right) => {
      const leftStatusOrder = left.matchup.status === 'live' ? 0 : 1
      const rightStatusOrder = right.matchup.status === 'live' ? 0 : 1

      return (
        leftStatusOrder - rightStatusOrder ||
        Date.parse(left.matchup.startsAt) - Date.parse(right.matchup.startsAt) ||
        (left.teamRank ?? Number.MAX_SAFE_INTEGER) - (right.teamRank ?? Number.MAX_SAFE_INTEGER) ||
        left.teamName.localeCompare(right.teamName)
      )
    })
}
