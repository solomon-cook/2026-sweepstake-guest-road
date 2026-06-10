import type { TeamScore, TeamSeed } from './types'

export const SCORE_SNAPSHOT = {
  date: 'June 9, 2026',
  totalScore: 100,
  sourceLabel: 'Prisma-backed World Cup winner odds snapshot',
  sourceNote:
    'The app reads persisted team scores from the database. This seed set was compiled from June 2026 public sportsbook summaries and betting previews.',
}

const RAW_TEAM_ODDS: TeamSeed[] = [
  { name: 'Mexico', flag: '🇲🇽', flagCode: 'mx', group: 'A', odds: 6000 },
  { name: 'South Africa', flag: '🇿🇦', flagCode: 'za', group: 'A', odds: 60000 },
  { name: 'South Korea', flag: '🇰🇷', flagCode: 'kr', group: 'A', odds: 10000 },
  { name: 'Czech Republic', flag: '🇨🇿', flagCode: 'cz', group: 'A', odds: 35000 },
  { name: 'Canada', flag: '🇨🇦', flagCode: 'ca', group: 'B', odds: 12500 },
  { name: 'Bosnia and Herzegovina', flag: '🇧🇦', flagCode: 'ba', group: 'B', odds: 40000 },
  { name: 'Qatar', flag: '🇶🇦', flagCode: 'qa', group: 'B', odds: 25000 },
  { name: 'Switzerland', flag: '🇨🇭', flagCode: 'ch', group: 'B', odds: 8000 },
  { name: 'Brazil', flag: '🇧🇷', flagCode: 'br', group: 'C', odds: 900 },
  { name: 'Morocco', flag: '🇲🇦', flagCode: 'ma', group: 'C', odds: 4500 },
  { name: 'Haiti', flag: '🇭🇹', flagCode: 'ht', group: 'C', odds: 125000 },
  { name: 'Scotland', flag: '🏴', flagCode: 'gb-sct', group: 'C', odds: 30000 },
  { name: 'United States', flag: '🇺🇸', flagCode: 'us', group: 'D', odds: 6500 },
  { name: 'Paraguay', flag: '🇵🇾', flagCode: 'py', group: 'D', odds: 15000 },
  { name: 'Australia', flag: '🇦🇺', flagCode: 'au', group: 'D', odds: 25000 },
  { name: 'Turkey', flag: '🇹🇷', flagCode: 'tr', group: 'D', odds: 15000 },
  { name: 'Germany', flag: '🇩🇪', flagCode: 'de', group: 'E', odds: 1400 },
  { name: 'Curaçao', flag: '🇨🇼', flagCode: 'cw', group: 'E', odds: 100000 },
  { name: 'Ivory Coast', flag: '🇨🇮', flagCode: 'ci', group: 'E', odds: 25000 },
  { name: 'Ecuador', flag: '🇪🇨', flagCode: 'ec', group: 'E', odds: 12500 },
  { name: 'Netherlands', flag: '🇳🇱', flagCode: 'nl', group: 'F', odds: 2200 },
  { name: 'Japan', flag: '🇯🇵', flagCode: 'jp', group: 'F', odds: 7500 },
  { name: 'Sweden', flag: '🇸🇪', flagCode: 'se', group: 'F', odds: 20000 },
  { name: 'Tunisia', flag: '🇹🇳', flagCode: 'tn', group: 'F', odds: 50000 },
  { name: 'Belgium', flag: '🇧🇪', flagCode: 'be', group: 'G', odds: 2800 },
  { name: 'Egypt', flag: '🇪🇬', flagCode: 'eg', group: 'G', odds: 17500 },
  { name: 'Iran', flag: '🇮🇷', flagCode: 'ir', group: 'G', odds: 25000 },
  { name: 'New Zealand', flag: '🇳🇿', flagCode: 'nz', group: 'G', odds: 150000 },
  { name: 'Spain', flag: '🇪🇸', flagCode: 'es', group: 'H', odds: 500 },
  { name: 'Cape Verde', flag: '🇨🇻', flagCode: 'cv', group: 'H', odds: 100000 },
  { name: 'Saudi Arabia', flag: '🇸🇦', flagCode: 'sa', group: 'H', odds: 50000 },
  { name: 'Uruguay', flag: '🇺🇾', flagCode: 'uy', group: 'H', odds: 3300 },
  { name: 'France', flag: '🇫🇷', flagCode: 'fr', group: 'I', odds: 500 },
  { name: 'Senegal', flag: '🇸🇳', flagCode: 'sn', group: 'I', odds: 9000 },
  { name: 'Iraq', flag: '🇮🇶', flagCode: 'iq', group: 'I', odds: 60000 },
  { name: 'Norway', flag: '🇳🇴', flagCode: 'no', group: 'I', odds: 5000 },
  { name: 'Argentina', flag: '🇦🇷', flagCode: 'ar', group: 'J', odds: 900 },
  { name: 'Algeria', flag: '🇩🇿', flagCode: 'dz', group: 'J', odds: 22500 },
  { name: 'Austria', flag: '🇦🇹', flagCode: 'at', group: 'J', odds: 12500 },
  { name: 'Jordan', flag: '🇯🇴', flagCode: 'jo', group: 'J', odds: 60000 },
  { name: 'Portugal', flag: '🇵🇹', flagCode: 'pt', group: 'K', odds: 1100 },
  { name: 'DR Congo', flag: '🇨🇩', flagCode: 'cd', group: 'K', odds: 80000 },
  { name: 'Uzbekistan', flag: '🇺🇿', flagCode: 'uz', group: 'K', odds: 60000 },
  { name: 'Colombia', flag: '🇨🇴', flagCode: 'co', group: 'K', odds: 3500 },
  { name: 'England', flag: '🏴', flagCode: 'gb-eng', group: 'L', odds: 700 },
  { name: 'Croatia', flag: '🇭🇷', flagCode: 'hr', group: 'L', odds: 4000 },
  { name: 'Ghana', flag: '🇬🇭', flagCode: 'gh', group: 'L', odds: 30000 },
  { name: 'Panama', flag: '🇵🇦', flagCode: 'pa', group: 'L', odds: 30000 },
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
