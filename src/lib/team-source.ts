import type { TeamScore, TeamSeed } from './types'

export const SCORE_SNAPSHOT = {
  date: 'June 9, 2026',
  totalScore: 100,
  sourceLabel: 'Prisma-backed World Cup winner odds snapshot',
  sourceNote:
    'The app reads persisted team scores from the database. This seed set was compiled from June 2026 public sportsbook summaries and betting previews.',
}

const RAW_TEAM_ODDS: TeamSeed[] = [
  { name: 'Mexico', flag: '🇲🇽', group: 'A', odds: 6000 },
  { name: 'South Africa', flag: '🇿🇦', group: 'A', odds: 60000 },
  { name: 'South Korea', flag: '🇰🇷', group: 'A', odds: 10000 },
  { name: 'Czech Republic', flag: '🇨🇿', group: 'A', odds: 35000 },
  { name: 'Canada', flag: '🇨🇦', group: 'B', odds: 12500 },
  { name: 'Bosnia and Herzegovina', flag: '🇧🇦', group: 'B', odds: 40000 },
  { name: 'Qatar', flag: '🇶🇦', group: 'B', odds: 25000 },
  { name: 'Switzerland', flag: '🇨🇭', group: 'B', odds: 8000 },
  { name: 'Brazil', flag: '🇧🇷', group: 'C', odds: 900 },
  { name: 'Morocco', flag: '🇲🇦', group: 'C', odds: 4500 },
  { name: 'Haiti', flag: '🇭🇹', group: 'C', odds: 125000 },
  { name: 'Scotland', flag: '🏴', group: 'C', odds: 30000 },
  { name: 'United States', flag: '🇺🇸', group: 'D', odds: 6500 },
  { name: 'Paraguay', flag: '🇵🇾', group: 'D', odds: 15000 },
  { name: 'Australia', flag: '🇦🇺', group: 'D', odds: 25000 },
  { name: 'Turkey', flag: '🇹🇷', group: 'D', odds: 15000 },
  { name: 'Germany', flag: '🇩🇪', group: 'E', odds: 1400 },
  { name: 'Curaçao', flag: '🇨🇼', group: 'E', odds: 100000 },
  { name: 'Ivory Coast', flag: '🇨🇮', group: 'E', odds: 25000 },
  { name: 'Ecuador', flag: '🇪🇨', group: 'E', odds: 12500 },
  { name: 'Netherlands', flag: '🇳🇱', group: 'F', odds: 2200 },
  { name: 'Japan', flag: '🇯🇵', group: 'F', odds: 7500 },
  { name: 'Sweden', flag: '🇸🇪', group: 'F', odds: 20000 },
  { name: 'Tunisia', flag: '🇹🇳', group: 'F', odds: 50000 },
  { name: 'Belgium', flag: '🇧🇪', group: 'G', odds: 2800 },
  { name: 'Egypt', flag: '🇪🇬', group: 'G', odds: 17500 },
  { name: 'Iran', flag: '🇮🇷', group: 'G', odds: 25000 },
  { name: 'New Zealand', flag: '🇳🇿', group: 'G', odds: 150000 },
  { name: 'Spain', flag: '🇪🇸', group: 'H', odds: 500 },
  { name: 'Cape Verde', flag: '🇨🇻', group: 'H', odds: 100000 },
  { name: 'Saudi Arabia', flag: '🇸🇦', group: 'H', odds: 50000 },
  { name: 'Uruguay', flag: '🇺🇾', group: 'H', odds: 3300 },
  { name: 'France', flag: '🇫🇷', group: 'I', odds: 500 },
  { name: 'Senegal', flag: '🇸🇳', group: 'I', odds: 9000 },
  { name: 'Iraq', flag: '🇮🇶', group: 'I', odds: 60000 },
  { name: 'Norway', flag: '🇳🇴', group: 'I', odds: 5000 },
  { name: 'Argentina', flag: '🇦🇷', group: 'J', odds: 900 },
  { name: 'Algeria', flag: '🇩🇿', group: 'J', odds: 22500 },
  { name: 'Austria', flag: '🇦🇹', group: 'J', odds: 12500 },
  { name: 'Jordan', flag: '🇯🇴', group: 'J', odds: 60000 },
  { name: 'Portugal', flag: '🇵🇹', group: 'K', odds: 1100 },
  { name: 'DR Congo', flag: '🇨🇩', group: 'K', odds: 80000 },
  { name: 'Uzbekistan', flag: '🇺🇿', group: 'K', odds: 60000 },
  { name: 'Colombia', flag: '🇨🇴', group: 'K', odds: 3500 },
  { name: 'England', flag: '🏴', group: 'L', odds: 700 },
  { name: 'Croatia', flag: '🇭🇷', group: 'L', odds: 4000 },
  { name: 'Ghana', flag: '🇬🇭', group: 'L', odds: 30000 },
  { name: 'Panama', flag: '🇵🇦', group: 'L', odds: 30000 },
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

export const TEAM_SEED_SCORES = buildTeamScores(RAW_TEAM_ODDS)
