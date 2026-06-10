export function formatScore(value: number) {
  return value.toFixed(2)
}

export function formatProbability(value: number) {
  return `${(value * 100).toFixed(1)}%`
}
