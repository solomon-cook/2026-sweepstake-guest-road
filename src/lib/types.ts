export type PlayerCount = 7 | 8 | 9

export type TeamSeed = {
  name: string
  group: string
  odds: number
}

export type TeamScore = TeamSeed & {
  id?: string
  impliedProbability: number
  score: number
  rank: number
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
