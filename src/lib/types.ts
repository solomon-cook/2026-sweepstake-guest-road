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

export type AllocationResult = {
  bundles: Bundle[]
  averageScore: number
  scoreSpread: number
  teamCountSpread: number
  percentDeviation: number
  balanceLabel: 'Very Balanced' | 'Balanced' | 'Loose'
}

export type PersistedDraw = {
  playerCount: PlayerCount
  allocation: AllocationResult
}
