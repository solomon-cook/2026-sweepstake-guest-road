import { formatProbability, formatScore } from '@/lib/formatters'
import type { CardResult, PersistedBundle, PersistedDraw, PlayerCount, PrizeCard } from '@/lib/types'

export type OpenPackInput = {
  playerCount: PlayerCount
  slotId: string
}

export type OpenPackResponse = {
  result: CardResult
  draw: PersistedDraw
}

export function toPrizeCard(team: PersistedBundle['teams'][number]): PrizeCard {
  return {
    id: team.id ?? team.name,
    name: team.name,
    flag: team.flag,
    flagImageUrl: team.flagImageUrl,
    imageLabel: `Group ${team.group}`,
    rank: team.rank,
    metadata: [
      { label: 'Score', value: formatScore(team.score) },
      { label: 'Odds', value: `+${team.odds}` },
      { label: 'Implied', value: formatProbability(team.impliedProbability) },
    ],
  }
}

export function toCardResult(bundle: PersistedBundle): CardResult {
  return {
    id: bundle.slotId,
    playerName: bundle.playerName,
    cards: bundle.teams.map(toPrizeCard),
  }
}

export async function openPack({ playerCount, slotId }: OpenPackInput): Promise<OpenPackResponse> {
  const response = await fetch('/api/draw', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'reveal-slot',
      playerCount,
      slotId,
    }),
  })
  const nextDraw = (await response.json()) as PersistedDraw | { error: string }

  if (!response.ok || 'error' in nextDraw) {
    throw new Error('error' in nextDraw ? nextDraw.error : 'Failed to open pack.')
  }

  const revealedBundle = nextDraw.allocation.bundles.find((bundle) => bundle.slotId === slotId)

  if (!revealedBundle) {
    throw new Error('The opened pack was not returned by the server.')
  }

  return {
    result: toCardResult(revealedBundle),
    draw: nextDraw,
  }
}

export async function openMockPack(): Promise<CardResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 450))

  // Mock only: this data is fixed on purpose. A real sweepstake outcome must come from
  // trusted server/app state and must not be selected by client-side randomness.
  return {
    id: 'mock-pack',
    playerName: 'Demo Player',
    cards: [
      {
        id: 'demo-1',
        name: 'Seeded Prize',
        flag: '🏁',
        imageLabel: 'A',
        rank: 12,
        metadata: [
          { label: 'Tier', value: 'Gold' },
          { label: 'Status', value: 'Server decided' },
        ],
      },
      {
        id: 'demo-2',
        name: 'Bonus Entry',
        flag: '🏁',
        imageLabel: 'B',
        rank: 28,
        metadata: [
          { label: 'Tier', value: 'Silver' },
          { label: 'Status', value: 'Server decided' },
        ],
      },
    ],
  }
}
