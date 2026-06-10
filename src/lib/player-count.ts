import type { PlayerCount } from './types'

export const PLAYER_COUNT_COOKIE = 'guest-road-player-count'
export const MIN_PLAYER_COUNT: PlayerCount = 7
export const MAX_PLAYER_COUNT: PlayerCount = 9

export function parsePlayerCount(value: unknown): PlayerCount | null {
  return value === 7 || value === 8 || value === 9 ? value : null
}

export function toPlayerCount(value: unknown): PlayerCount | null {
  const numericValue = typeof value === 'string' ? Number(value) : value
  return parsePlayerCount(numericValue)
}
