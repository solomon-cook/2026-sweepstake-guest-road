import { buildTeamDisplayStates } from './leaderboard'
import { normalizeTeamName } from './matchups'
import type { FanImageKind, MatchFixture, PersistedDraw, TeamScore } from './types'

export type AllocationDisplayState = {
  bundleMoodBySlotId: Record<string, FanImageKind>
  teamsByName: ReturnType<typeof buildTeamDisplayStates>
}

type AllocationTeamDisplayState = ReturnType<typeof buildTeamDisplayStates>[string]

function selectBundleMood(draw: PersistedDraw, teamsByName: Record<string, AllocationTeamDisplayState>) {
  return Object.fromEntries(
    draw.allocation.bundles.map((bundle) => {
      const aliveTeamCount = bundle.teams.filter((team) => teamsByName[normalizeTeamName(team.name)]?.isAlive).length
      const mood: FanImageKind =
        aliveTeamCount === 0 ? 'devastated' : aliveTeamCount > bundle.teams.length / 2 ? 'ecstatic' : 'neutral'

      return [bundle.slotId, mood]
    }),
  )
}

export function buildAllocationDisplayState(
  teams: TeamScore[],
  draw: PersistedDraw,
  fixtures: MatchFixture[],
): AllocationDisplayState {
  const teamsByName = buildTeamDisplayStates(teams, draw, fixtures)

  return {
    teamsByName,
    bundleMoodBySlotId: selectBundleMood(draw, teamsByName),
  }
}
