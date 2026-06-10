import type { TeamScore, TeamSeed } from './types'

export const SCORE_SNAPSHOT = {
  date: 'June 9, 2026',
  totalScore: 100,
  sourceLabel: 'Prisma-backed World Cup winner odds snapshot',
  sourceNote:
    'The app reads persisted team scores from the database. This seed set was compiled from June 2026 public sportsbook summaries and betting previews.',
}

function buildFlagCdnUrl(flagCode: string) {
  return `https://flagcdn.com/w20/${flagCode}.jpg`
}

const RAW_TEAM_ODDS: TeamSeed[] = [
  { name: 'Mexico', flag: buildFlagCdnUrl('mx'), flagCode: 'mx', group: 'A', odds: 6000 },
  { name: 'South Africa', flag: buildFlagCdnUrl('za'), flagCode: 'za', group: 'A', odds: 60000 },
  { name: 'South Korea', flag: buildFlagCdnUrl('kr'), flagCode: 'kr', group: 'A', odds: 10000 },
  { name: 'Czech Republic', flag: buildFlagCdnUrl('cz'), flagCode: 'cz', group: 'A', odds: 35000 },
  { name: 'Canada', flag: buildFlagCdnUrl('ca'), flagCode: 'ca', group: 'B', odds: 12500 },
  { name: 'Bosnia and Herzegovina', flag: buildFlagCdnUrl('ba'), flagCode: 'ba', group: 'B', odds: 40000 },
  { name: 'Qatar', flag: buildFlagCdnUrl('qa'), flagCode: 'qa', group: 'B', odds: 25000 },
  { name: 'Switzerland', flag: buildFlagCdnUrl('ch'), flagCode: 'ch', group: 'B', odds: 8000 },
  { name: 'Brazil', flag: buildFlagCdnUrl('br'), flagCode: 'br', group: 'C', odds: 900 },
  { name: 'Morocco', flag: buildFlagCdnUrl('ma'), flagCode: 'ma', group: 'C', odds: 4500 },
  { name: 'Haiti', flag: buildFlagCdnUrl('ht'), flagCode: 'ht', group: 'C', odds: 125000 },
  { name: 'Scotland', flag: buildFlagCdnUrl('gb-sct'), flagCode: 'gb-sct', group: 'C', odds: 30000 },
  { name: 'United States', flag: buildFlagCdnUrl('us'), flagCode: 'us', group: 'D', odds: 6500 },
  { name: 'Paraguay', flag: buildFlagCdnUrl('py'), flagCode: 'py', group: 'D', odds: 15000 },
  { name: 'Australia', flag: buildFlagCdnUrl('au'), flagCode: 'au', group: 'D', odds: 25000 },
  { name: 'Turkey', flag: buildFlagCdnUrl('tr'), flagCode: 'tr', group: 'D', odds: 15000 },
  { name: 'Germany', flag: buildFlagCdnUrl('de'), flagCode: 'de', group: 'E', odds: 1400 },
  { name: 'Curaçao', flag: buildFlagCdnUrl('cw'), flagCode: 'cw', group: 'E', odds: 100000 },
  { name: 'Ivory Coast', flag: buildFlagCdnUrl('ci'), flagCode: 'ci', group: 'E', odds: 25000 },
  { name: 'Ecuador', flag: buildFlagCdnUrl('ec'), flagCode: 'ec', group: 'E', odds: 12500 },
  { name: 'Netherlands', flag: buildFlagCdnUrl('nl'), flagCode: 'nl', group: 'F', odds: 2200 },
  { name: 'Japan', flag: buildFlagCdnUrl('jp'), flagCode: 'jp', group: 'F', odds: 7500 },
  { name: 'Sweden', flag: buildFlagCdnUrl('se'), flagCode: 'se', group: 'F', odds: 20000 },
  { name: 'Tunisia', flag: buildFlagCdnUrl('tn'), flagCode: 'tn', group: 'F', odds: 50000 },
  { name: 'Belgium', flag: buildFlagCdnUrl('be'), flagCode: 'be', group: 'G', odds: 2800 },
  { name: 'Egypt', flag: buildFlagCdnUrl('eg'), flagCode: 'eg', group: 'G', odds: 17500 },
  { name: 'Iran', flag: buildFlagCdnUrl('ir'), flagCode: 'ir', group: 'G', odds: 25000 },
  { name: 'New Zealand', flag: buildFlagCdnUrl('nz'), flagCode: 'nz', group: 'G', odds: 150000 },
  { name: 'Spain', flag: buildFlagCdnUrl('es'), flagCode: 'es', group: 'H', odds: 500 },
  { name: 'Cape Verde', flag: buildFlagCdnUrl('cv'), flagCode: 'cv', group: 'H', odds: 100000 },
  { name: 'Saudi Arabia', flag: buildFlagCdnUrl('sa'), flagCode: 'sa', group: 'H', odds: 50000 },
  { name: 'Uruguay', flag: buildFlagCdnUrl('uy'), flagCode: 'uy', group: 'H', odds: 3300 },
  { name: 'France', flag: buildFlagCdnUrl('fr'), flagCode: 'fr', group: 'I', odds: 500 },
  { name: 'Senegal', flag: buildFlagCdnUrl('sn'), flagCode: 'sn', group: 'I', odds: 9000 },
  { name: 'Iraq', flag: buildFlagCdnUrl('iq'), flagCode: 'iq', group: 'I', odds: 60000 },
  { name: 'Norway', flag: buildFlagCdnUrl('no'), flagCode: 'no', group: 'I', odds: 5000 },
  { name: 'Argentina', flag: buildFlagCdnUrl('ar'), flagCode: 'ar', group: 'J', odds: 900 },
  { name: 'Algeria', flag: buildFlagCdnUrl('dz'), flagCode: 'dz', group: 'J', odds: 22500 },
  { name: 'Austria', flag: buildFlagCdnUrl('at'), flagCode: 'at', group: 'J', odds: 12500 },
  { name: 'Jordan', flag: buildFlagCdnUrl('jo'), flagCode: 'jo', group: 'J', odds: 60000 },
  { name: 'Portugal', flag: buildFlagCdnUrl('pt'), flagCode: 'pt', group: 'K', odds: 1100 },
  { name: 'DR Congo', flag: buildFlagCdnUrl('cd'), flagCode: 'cd', group: 'K', odds: 80000 },
  { name: 'Uzbekistan', flag: buildFlagCdnUrl('uz'), flagCode: 'uz', group: 'K', odds: 60000 },
  { name: 'Colombia', flag: buildFlagCdnUrl('co'), flagCode: 'co', group: 'K', odds: 3500 },
  { name: 'England', flag: buildFlagCdnUrl('gb-eng'), flagCode: 'gb-eng', group: 'L', odds: 700 },
  { name: 'Croatia', flag: buildFlagCdnUrl('hr'), flagCode: 'hr', group: 'L', odds: 4000 },
  { name: 'Ghana', flag: buildFlagCdnUrl('gh'), flagCode: 'gh', group: 'L', odds: 30000 },
  { name: 'Panama', flag: buildFlagCdnUrl('pa'), flagCode: 'pa', group: 'L', odds: 30000 },
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
