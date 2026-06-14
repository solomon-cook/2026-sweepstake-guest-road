import { generateBalancedAllocation } from './allocator'
import { getPrismaClient } from './prisma'
import type {
  AllocationResult,
  ParticipantPhotoInput,
  PersistedAllocationResult,
  PersistedDraw,
  PlayerCount,
  TeamScore,
} from './types'

const DEFAULT_NAMES = ['', '', '', '', '', '', '', '', ''] as const
const LEGACY_DEFAULT_NAMES = [
  'Sam Felton',
  'Sam Robinson',
  'Dan Blackford',
  'Dan Tarrant',
  'Solomon Cook',
  'Navid Lorchi',
  'Callum Fisher',
  '',
  '',
] as const
const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_PHOTO_BYTES = 300 * 1024

function buildFlagImageUrl(teamId?: string) {
  return teamId ? `/api/team-flags/${teamId}` : undefined
}

function defaultNames(playerCount: PlayerCount) {
  return DEFAULT_NAMES.slice(0, playerCount)
}

function decodePhotoInput(participant: ParticipantPhotoInput) {
  if (participant.photoDataBase64 === undefined && participant.photoMimeType === undefined) {
    return undefined
  }

  if (participant.photoDataBase64 === null || participant.photoMimeType === null) {
    return {
      photoMimeType: null,
      photoData: null,
    }
  }

  if (
    typeof participant.photoDataBase64 !== 'string' ||
    typeof participant.photoMimeType !== 'string' ||
    !ALLOWED_PHOTO_MIME_TYPES.has(participant.photoMimeType)
  ) {
    throw new Error('Invalid participant photo.')
  }

  const decodedPhoto = Buffer.from(participant.photoDataBase64, 'base64')
  const photoData: Uint8Array<ArrayBuffer> = new Uint8Array(decodedPhoto.byteLength)
  photoData.set(decodedPhoto)

  if (photoData.byteLength > MAX_PHOTO_BYTES) {
    throw new Error('Participant photos must be 300KB or smaller.')
  }

  return {
    photoMimeType: participant.photoMimeType,
    photoData,
  }
}

export function buildParticipantSlotUpdate(participant: ParticipantPhotoInput) {
  const photoUpdate = decodePhotoInput(participant)
  const data: {
    playerName?: string
    photoMimeType?: string | null
    photoData?: Uint8Array<ArrayBuffer> | null
  } = {}

  if (typeof participant.playerName === 'string') {
    data.playerName = participant.playerName.trim()
  }

  if (photoUpdate) {
    data.photoMimeType = photoUpdate.photoMimeType
    data.photoData = photoUpdate.photoData
  }

  return data
}

async function resetLegacyNamesIfNeeded(
  playerCount: PlayerCount,
  prisma: ReturnType<typeof getPrismaClient>,
  slots: Array<{ id: string; playerName: string; slotIndex: number }>,
) {
  const orderedSlots = [...slots].sort((left, right) => left.slotIndex - right.slotIndex)
  const legacyNames = LEGACY_DEFAULT_NAMES.slice(0, playerCount)
  const isLegacyDraw = orderedSlots.every((slot, index) => slot.playerName === legacyNames[index])

  if (!isLegacyDraw) {
    return false
  }

  await Promise.all(
    orderedSlots.map((slot) =>
      prisma.drawSlot.update({
        where: { id: slot.id },
        data: {
          playerName: '',
          isRevealed: false,
        },
      }),
    ),
  )

  return true
}

export function calculateMetrics(bundles: AllocationResult['bundles']) {
  const totals = bundles.map((bundle) => bundle.totalScore)
  const averageScore = totals.reduce((sum, total) => sum + total, 0) / bundles.length
  const maxScore = Math.max(...totals)
  const minScore = Math.min(...totals)
  const teamCounts = bundles.map((bundle) => bundle.teams.length)
  const scoreSpread = Number((maxScore - minScore).toFixed(2))
  const percentDeviation = Number((((scoreSpread / 2) / averageScore) * 100).toFixed(2))
  const teamCountSpread = Math.max(...teamCounts) - Math.min(...teamCounts)
  const balanceLabel =
    percentDeviation <= 2.5 ? 'Very Balanced' : percentDeviation <= 5 ? 'Balanced' : 'Loose'

  return {
    averageScore: Number(averageScore.toFixed(2)),
    scoreSpread,
    teamCountSpread,
    percentDeviation,
    balanceLabel,
  } as const
}

export function toPersistedDraw(
  playerCount: PlayerCount,
  slots: Array<{
    id: string
    playerName: string
    totalScore: number
    slotIndex: number
    isRevealed: boolean
    teamAssignments: Array<{
      teamOrder: number
      team: TeamScore
    }>
  }>,
): PersistedDraw {
  const bundles: PersistedAllocationResult['bundles'] = [...slots]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((slot) => ({
      slotId: slot.id,
      slotIndex: slot.slotIndex,
      playerName: slot.playerName,
      totalScore: slot.totalScore,
      isRevealed: slot.isRevealed,
      teams: [...slot.teamAssignments]
        .sort((left, right) => left.teamOrder - right.teamOrder)
        .map((assignment) => ({
          ...assignment.team,
          flagImageUrl: buildFlagImageUrl(assignment.team.id),
        })),
    }))

  return {
    playerCount,
    allocation: {
      bundles,
      ...calculateMetrics(bundles),
    },
  }
}

async function replaceDrawAllocationWithHiddenSlots(
  drawId: string,
  allocation: AllocationResult,
  prisma: ReturnType<typeof getPrismaClient>,
) {
  const existingSlots = await prisma.drawSlot.findMany({
    where: { drawId },
    select: { id: true },
  })

  if (existingSlots.length) {
    await prisma.drawSlotTeam.deleteMany({
      where: {
        slotId: {
          in: existingSlots.map((slot) => slot.id),
        },
      },
    })
    await prisma.drawSlot.deleteMany({
      where: { drawId },
    })
  }

  for (const [slotIndex, bundle] of allocation.bundles.entries()) {
    const slot = await prisma.drawSlot.create({
      data: {
        drawId,
        slotIndex,
        playerName: bundle.playerName,
        totalScore: bundle.totalScore,
        isRevealed: false,
      },
    })

    await prisma.drawSlotTeam.createMany({
      data: bundle.teams.map((team, teamOrder) => ({
        slotId: slot.id,
        teamId: team.id!,
        teamOrder,
      })),
    })
  }
}

async function loadPersistedDraw(playerCount: PlayerCount) {
  const prisma = getPrismaClient()
  return prisma.draw.findUnique({
    where: { playerCount },
    include: {
      slots: {
        include: {
          teamAssignments: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  flag: true,
                  flagCode: true,
                  group: true,
                  odds: true,
                  impliedProbability: true,
                  score: true,
                  rank: true,
                },
              },
            },
          },
        },
      },
    },
  })
}

export async function getOrCreateDraw(playerCount: PlayerCount, teamScores: TeamScore[]) {
  const existing = await loadPersistedDraw(playerCount)

  if (existing) {
    const prisma = getPrismaClient()
    const wasReset = await resetLegacyNamesIfNeeded(playerCount, prisma, existing.slots)

    if (wasReset) {
      const refreshed = await loadPersistedDraw(playerCount)
      return toPersistedDraw(playerCount, refreshed!.slots as never)
    }

    return toPersistedDraw(playerCount, existing.slots as never)
  }

  const prisma = getPrismaClient()
  try {
    const draw = await prisma.draw.create({
      data: { playerCount },
    })

    const allocation = generateBalancedAllocation(teamScores, defaultNames(playerCount), playerCount)
    await replaceDrawAllocationWithHiddenSlots(draw.id, allocation, prisma)
  } catch (error) {
    const isUniqueConflict =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'

    if (!isUniqueConflict) {
      throw error
    }
  }

  const created = await loadPersistedDraw(playerCount)
  return toPersistedDraw(playerCount, created!.slots as never)
}

export async function shuffleDraw(playerCount: PlayerCount, teamScores: TeamScore[]) {
  const prisma = getPrismaClient()
  const existing = await getOrCreateDraw(playerCount, teamScores)
  const draw = await prisma.draw.findUniqueOrThrow({
    where: { playerCount },
  })
  const names = existing.allocation.bundles.map((bundle) => bundle.playerName)
  const allocation = generateBalancedAllocation(teamScores, names, playerCount)

  await replaceDrawAllocationWithHiddenSlots(draw.id, allocation, prisma)

  const refreshed = await loadPersistedDraw(playerCount)
  return toPersistedDraw(playerCount, refreshed!.slots as never)
}

export async function updateDrawNames(playerCount: PlayerCount, names: string[], teamScores: TeamScore[]) {
  const prisma = getPrismaClient()
  await getOrCreateDraw(playerCount, teamScores)

  const draw = await prisma.draw.findUniqueOrThrow({
    where: { playerCount },
    include: {
      slots: {
        orderBy: { slotIndex: 'asc' },
      },
    },
  })

  for (const [index, slot] of draw.slots.entries()) {
    await prisma.drawSlot.update({
      where: { id: slot.id },
      data: {
        playerName: names[index]?.trim() ?? '',
      },
    })
  }

  const refreshed = await loadPersistedDraw(playerCount)
  return toPersistedDraw(playerCount, refreshed!.slots as never)
}

export async function claimNextDrawSlot(playerCount: PlayerCount, playerName: string, teamScores: TeamScore[]) {
  const normalizedName = playerName.trim()

  if (!normalizedName) {
    throw new Error('Enter your name before claiming a pack.')
  }

  const prisma = getPrismaClient()
  await getOrCreateDraw(playerCount, teamScores)

  const draw = await prisma.draw.findUniqueOrThrow({
    where: { playerCount },
    include: {
      slots: {
        orderBy: { slotIndex: 'asc' },
      },
    },
  })

  const openSlot = draw.slots.find((slot) => !slot.playerName.trim())

  if (!openSlot) {
    throw new Error('All seven packs have already been claimed.')
  }

  await prisma.drawSlot.update({
    where: { id: openSlot.id },
    data: {
      playerName: normalizedName,
      isRevealed: false,
    },
  })

  const refreshed = await loadPersistedDraw(playerCount)

  return {
    claimedSlotId: openSlot.id,
    draw: toPersistedDraw(playerCount, refreshed!.slots as never),
  }
}

export async function revealDrawSlot(playerCount: PlayerCount, slotId: string, teamScores: TeamScore[]) {
  const prisma = getPrismaClient()
  await getOrCreateDraw(playerCount, teamScores)

  const draw = await prisma.draw.findUniqueOrThrow({
    where: { playerCount },
    include: {
      slots: {
        select: { id: true },
      },
    },
  })

  const matchingSlot = draw.slots.find((slot) => slot.id === slotId)

  if (!matchingSlot) {
    throw new Error('Slot does not belong to this draw.')
  }

  await prisma.drawSlot.update({
    where: { id: slotId },
    data: { isRevealed: true },
  })

  const refreshed = await loadPersistedDraw(playerCount)
  return toPersistedDraw(playerCount, refreshed!.slots as never)
}

export async function resetDrawRevealState(playerCount: PlayerCount, teamScores: TeamScore[]) {
  const prisma = getPrismaClient()
  await getOrCreateDraw(playerCount, teamScores)

  await prisma.drawSlot.updateMany({
    where: {
      draw: { playerCount },
    },
    data: { isRevealed: false },
  })

  const refreshed = await loadPersistedDraw(playerCount)
  return toPersistedDraw(playerCount, refreshed!.slots as never)
}

export async function clearDrawPlayers(playerCount: PlayerCount, teamScores: TeamScore[]) {
  const prisma = getPrismaClient()
  await getOrCreateDraw(playerCount, teamScores)

  await prisma.drawSlot.updateMany({
    where: {
      draw: { playerCount },
    },
    data: {
      playerName: '',
      isRevealed: false,
    },
  })

  const refreshed = await loadPersistedDraw(playerCount)
  return toPersistedDraw(playerCount, refreshed!.slots as never)
}
