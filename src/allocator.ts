import type { AllocationResult, Bundle, PlayerCount, TeamScore } from './types'

const ITERATIONS = 80

function shuffleTeams(teams: TeamScore[]) {
  const cloned = [...teams]

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]]
  }

  return cloned
}

function buildTargetCounts(playerCount: PlayerCount) {
  const baseCount = Math.floor(48 / playerCount)
  const remainder = 48 % playerCount

  return Array.from({ length: playerCount }, (_, index) =>
    index < remainder ? baseCount + 1 : baseCount,
  )
}

function createEmptyBundles(playerNames: string[]): Bundle[] {
  return playerNames.map((playerName, index) => ({
    playerName: playerName.trim() || `Player ${index + 1}`,
    teams: [],
    totalScore: 0,
  }))
}

function scoreAllocation(bundles: Bundle[]) {
  const totals = bundles.map((bundle) => bundle.totalScore)
  const averageScore = totals.reduce((sum, total) => sum + total, 0) / bundles.length
  const maxScore = Math.max(...totals)
  const minScore = Math.min(...totals)
  const scoreSpread = Number((maxScore - minScore).toFixed(2))
  const percentDeviation = Number(
    (((scoreSpread / 2) / averageScore) * 100).toFixed(2),
  )
  const teamCounts = bundles.map((bundle) => bundle.teams.length)
  const teamCountSpread = Math.max(...teamCounts) - Math.min(...teamCounts)

  let balanceLabel: AllocationResult['balanceLabel'] = 'Loose'

  if (percentDeviation <= 2.5) {
    balanceLabel = 'Very Balanced'
  } else if (percentDeviation <= 5) {
    balanceLabel = 'Balanced'
  }

  return {
    averageScore: Number(averageScore.toFixed(2)),
    scoreSpread,
    teamCountSpread,
    percentDeviation,
    balanceLabel,
  }
}

function recalculateBundleTotal(bundle: Bundle) {
  bundle.totalScore = Number(
    bundle.teams.reduce((sum, team) => sum + team.score, 0).toFixed(2),
  )
}

function cloneBundles(bundles: Bundle[]) {
  return bundles.map((bundle) => ({
    ...bundle,
    teams: [...bundle.teams],
  }))
}

function optimizeBundles(initialBundles: Bundle[]) {
  const bundles = cloneBundles(initialBundles)
  let improved = true

  while (improved) {
    improved = false
    let bestNext = bundles
    let bestMetrics = scoreAllocation(bundles)

    for (let leftIndex = 0; leftIndex < bundles.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bundles.length; rightIndex += 1) {
        const leftBundle = bundles[leftIndex]
        const rightBundle = bundles[rightIndex]

        for (let leftTeamIndex = 0; leftTeamIndex < leftBundle.teams.length; leftTeamIndex += 1) {
          for (
            let rightTeamIndex = 0;
            rightTeamIndex < rightBundle.teams.length;
            rightTeamIndex += 1
          ) {
            const candidate = cloneBundles(bundles)
            const nextLeft = candidate[leftIndex]
            const nextRight = candidate[rightIndex]
            const leftTeam = nextLeft.teams[leftTeamIndex]
            const rightTeam = nextRight.teams[rightTeamIndex]

            nextLeft.teams[leftTeamIndex] = rightTeam
            nextRight.teams[rightTeamIndex] = leftTeam
            recalculateBundleTotal(nextLeft)
            recalculateBundleTotal(nextRight)

            const candidateMetrics = scoreAllocation(candidate)

            if (
              candidateMetrics.scoreSpread < bestMetrics.scoreSpread ||
              (candidateMetrics.scoreSpread === bestMetrics.scoreSpread &&
                candidateMetrics.percentDeviation < bestMetrics.percentDeviation)
            ) {
              bestNext = candidate
              bestMetrics = candidateMetrics
              improved = true
            }
          }
        }
      }
    }

    if (improved) {
      for (let index = 0; index < bundles.length; index += 1) {
        bundles[index] = bestNext[index]
      }
    }
  }

  return bundles
}

function generateCandidate(teams: TeamScore[], playerNames: string[], targetCounts: number[]) {
  const bundles = createEmptyBundles(playerNames)

  for (const team of shuffleTeams(teams)) {
    const eligibleBundles = bundles.filter(
      (bundle, index) => bundle.teams.length < targetCounts[index],
    )

    eligibleBundles.sort((left, right) => {
      if (left.totalScore !== right.totalScore) {
        return left.totalScore - right.totalScore
      }

      return left.teams.length - right.teams.length
    })

    const chosen = eligibleBundles[0]
    chosen.teams.push(team)
    chosen.totalScore = Number((chosen.totalScore + team.score).toFixed(2))
  }

  for (const bundle of bundles) {
    bundle.teams.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
  }

  const optimizedBundles = optimizeBundles(bundles)

  for (const bundle of optimizedBundles) {
    bundle.teams.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
  }

  const metrics = scoreAllocation(optimizedBundles)

  return {
    bundles: optimizedBundles,
    ...metrics,
  }
}

function compareResults(left: AllocationResult, right: AllocationResult) {
  if (left.scoreSpread !== right.scoreSpread) {
    return left.scoreSpread - right.scoreSpread
  }

  if (left.percentDeviation !== right.percentDeviation) {
    return left.percentDeviation - right.percentDeviation
  }

  return left.teamCountSpread - right.teamCountSpread
}

export function rankAllocation(result: AllocationResult) {
  return {
    averageScore: result.averageScore,
    scoreSpread: result.scoreSpread,
    teamCountSpread: result.teamCountSpread,
    percentDeviation: result.percentDeviation,
    balanceLabel: result.balanceLabel,
  }
}

export function generateBalancedAllocation(
  teamScores: TeamScore[],
  playerNames: string[],
  playerCount: PlayerCount,
): AllocationResult {
  const targetCounts = buildTargetCounts(playerCount)
  const normalizedNames = Array.from({ length: playerCount }, (_, index) => playerNames[index] ?? '')
  let bestResult = generateCandidate(teamScores, normalizedNames, targetCounts)

  for (let attempt = 1; attempt < ITERATIONS; attempt += 1) {
    const candidate = generateCandidate(teamScores, normalizedNames, targetCounts)

    if (compareResults(candidate, bestResult) < 0) {
      bestResult = candidate
    }
  }

  return bestResult
}
