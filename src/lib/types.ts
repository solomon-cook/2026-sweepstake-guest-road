export type PlayerCount = 7 | 8 | 9
export type FanImageStatus = 'idle' | 'pending' | 'ready' | 'failed'
export type FanImageKind = 'neutral' | 'ecstatic' | 'devastated'

export type TeamSeed = {
  name: string
  flag: string
  flagCode: string
  group: string
  odds: number
}

export type TeamScore = TeamSeed & {
  id?: string
  flagImageUrl?: string
  impliedProbability: number
  score: number
  rank: number
}

export type PrizeCard = {
  id: string
  name: string
  flagImageUrl?: string
  imageLabel: string
  metadata: Array<{
    label: string
    value: string
  }>
  rank?: number
}

export type CardResult = {
  id: string
  playerName: string
  cards: PrizeCard[]
}

export type Bundle = {
  playerName: string
  teams: TeamScore[]
  totalScore: number
}

export type PersistedBundle = Bundle & {
  slotId: string
  slotIndex: number
  isRevealed: boolean
  sourcePhotoUrl?: string | null
  fanImageStatus: FanImageStatus
  fanImageError?: string | null
  fanImageTeamName?: string | null
  fanImageUrls?: {
    neutral?: string | null
    ecstatic?: string | null
    devastated?: string | null
  } | null
}

export type AllocationResult = {
  bundles: Bundle[]
  averageScore: number
  scoreSpread: number
  teamCountSpread: number
  percentDeviation: number
  balanceLabel: 'Very Balanced' | 'Balanced' | 'Loose'
}

export type PersistedAllocationResult = Omit<AllocationResult, 'bundles'> & {
  bundles: PersistedBundle[]
}

export type PersistedDraw = {
  playerCount: PlayerCount
  allocation: PersistedAllocationResult
}

export type ParticipantPhotoInput = {
  slotId: string
  playerName?: string
  photoMimeType?: string | null
  photoDataBase64?: string | null
}

export type FixtureStatus = 'live' | 'upcoming' | 'finished' | 'unknown'

export type MatchFixture = {
  id: string
  startsAt: string
  status: FixtureStatus
  statusLabel: string
  round?: string | null
  venue?: string | null
  homeTeam: string
  awayTeam: string
  homeScore?: number | null
  awayScore?: number | null
}

export type MatchOdds = {
  home?: string | null
  draw?: string | null
  away?: string | null
  source?: string | null
  homeProbability?: number | null
  awayProbability?: number | null
}

export type MatchupSide = {
  teamName: string
  teamFlagImageUrl?: string | null
  ownerName: string
  ownerSourcePhotoUrl?: string | null
  ownerNeutralPhotoUrl?: string | null
  ownerEcstaticPhotoUrl?: string | null
  ownerDevastatedPhotoUrl?: string | null
  teamScore?: number | null
  isAssigned: boolean
}

export type MatchupView = {
  fixture: MatchFixture
  home: MatchupSide
  away: MatchupSide
  odds?: MatchOdds | null
}
