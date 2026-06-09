import type { TeamScore, TeamSeed } from './types'

export const SCORE_SNAPSHOT = {
  date: 'June 9, 2026',
  totalScore: 100,
  sourceLabel: 'Public World Cup winner odds snapshot',
  sourceNote:
    'Compiled from June 2026 public sportsbook summaries and betting previews. Refresh manually in code if you want a new draw basis.',
}

const RAW_TEAM_ODDS: TeamSeed[] = [
  { name: 'Mexico', group: 'A', odds: 6000 },
  { name: 'South Africa', group: 'A', odds: 60000 },
  { name: 'South Korea', group: 'A', odds: 10000 },
  { name: 'Czech Republic', group: 'A', odds: 35000 },
  { name: 'Canada', group: 'B', odds: 12500 },
  { name: 'Bosnia and Herzegovina', group: 'B', odds: 40000 },
  { name: 'Qatar', group: 'B', odds: 25000 },
  { name: 'Switzerland', group: 'B', odds: 8000 },
  { name: 'Brazil', group: 'C', odds: 900 },
  { name: 'Morocco', group: 'C', odds: 4500 },
  { name: 'Haiti', group: 'C', odds: 125000 },
  { name: 'Scotland', group: 'C', odds: 30000 },
  { name: 'United States', group: 'D', odds: 6500 },
  { name: 'Paraguay', group: 'D', odds: 15000 },
  { name: 'Australia', group: 'D', odds: 25000 },
  { name: 'Turkey', group: 'D', odds: 15000 },
  { name: 'Germany', group: 'E', odds: 1400 },
  { name: 'Curaçao', group: 'E', odds: 100000 },
  { name: 'Ivory Coast', group: 'E', odds: 25000 },
  { name: 'Ecuador', group: 'E', odds: 12500 },
  { name: 'Netherlands', group: 'F', odds: 2200 },
  { name: 'Japan', group: 'F', odds: 7500 },
  { name: 'Sweden', group: 'F', odds: 20000 },
  { name: 'Tunisia', group: 'F', odds: 50000 },
  { name: 'Belgium', group: 'G', odds: 2800 },
  { name: 'Egypt', group: 'G', odds: 17500 },
  { name: 'Iran', group: 'G', odds: 25000 },
  { name: 'New Zealand', group: 'G', odds: 150000 },
  { name: 'Spain', group: 'H', odds: 500 },
  { name: 'Cape Verde', group: 'H', odds: 100000 },
  { name: 'Saudi Arabia', group: 'H', odds: 50000 },
  { name: 'Uruguay', group: 'H', odds: 3300 },
  { name: 'France', group: 'I', odds: 500 },
  { name: 'Senegal', group: 'I', odds: 9000 },
  { name: 'Iraq', group: 'I', odds: 60000 },
  { name: 'Norway', group: 'I', odds: 5000 },
  { name: 'Argentina', group: 'J', odds: 900 },
  { name: 'Algeria', group: 'J', odds: 22500 },
  { name: 'Austria', group: 'J', odds: 12500 },
  { name: 'Jordan', group: 'J', odds: 60000 },
  { name: 'Portugal', group: 'K', odds: 1100 },
  { name: 'DR Congo', group: 'K', odds: 80000 },
  { name: 'Uzbekistan', group: 'K', odds: 60000 },
  { name: 'Colombia', group: 'K', odds: 3500 },
  { name: 'England', group: 'L', odds: 700 },
  { name: 'Croatia', group: 'L', odds: 4000 },
  { name: 'Ghana', group: 'L', odds: 30000 },
  { name: 'Panama', group: 'L', odds: 30000 },
]

export function buildTeamScores(rawOddsData: TeamSeed[]): TeamScore[] {
  const withProbability = rawOddsData.map((team) => ({
    ...team,
    impliedProbability: 100 / (team.odds + 100),
  }))

  const totalProbability = withProbability.reduce(
    (sum, team) => sum + team.impliedProbability,
    0,
  )

  return withProbability
    .map((team) => ({
      ...team,
      score: Number(
        ((team.impliedProbability / totalProbability) * SCORE_SNAPSHOT.totalScore).toFixed(2),
      ),
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }))
}

export const TEAM_SCORES = buildTeamScores(RAW_TEAM_ODDS)
