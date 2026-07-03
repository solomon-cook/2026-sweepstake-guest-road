import { getPrismaClient } from './prisma'
import type { FanImageKind, FanImageStatus, TeamScore } from './types'

export const ALLOWED_PARTICIPANT_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])
export const ALLOWED_PARTICIPANT_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.heics',
  '.heifs',
])
export const MAX_PARTICIPANT_PHOTO_BYTES = 2 * 1024 * 1024

export type ParticipantImageSlot = {
  id: string
  playerName: string
  photoMimeType: string | null
  photoData: Uint8Array<ArrayBuffer> | null
  generatedImageMimeType: string | null
  neutralImageData: Uint8Array<ArrayBuffer> | null
  ecstaticImageData: Uint8Array<ArrayBuffer> | null
  devastatedImageData: Uint8Array<ArrayBuffer> | null
  fanImageStatus: FanImageStatus
  fanImageError: string | null
  fanImageTeamId: string | null
  isRevealed: boolean
  teamAssignments: Array<{
    teamOrder: number
    team: TeamScore
  }>
}

export type ParticipantImageReadResult =
  | {
      status: 'ready'
      bytes: Uint8Array<ArrayBuffer>
      mimeType: string
    }
  | {
      status: 'missing-slot' | 'missing-image'
    }

function normalizeFanImageStatus(value: string | null | undefined): FanImageStatus {
  if (value === 'pending' || value === 'ready' || value === 'failed') {
    return value
  }

  return 'idle'
}

function toStoredBytes(bytes: Uint8Array<ArrayBufferLike>) {
  const photoData: Uint8Array<ArrayBuffer> = new Uint8Array(bytes.byteLength)
  photoData.set(bytes)
  return photoData
}

export function selectTopRatedTeam(slot: ParticipantImageSlot) {
  return [...slot.teamAssignments]
    .map((assignment) => assignment.team)
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name))[0] ?? null
}

export async function loadParticipantImageSlot(slotId: string): Promise<ParticipantImageSlot | null> {
  const prisma = getPrismaClient()
  const slot = await prisma.drawSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      playerName: true,
      photoMimeType: true,
      photoData: true,
      generatedImageMimeType: true,
      neutralImageData: true,
      ecstaticImageData: true,
      devastatedImageData: true,
      fanImageStatus: true,
      fanImageError: true,
      fanImageTeamId: true,
      isRevealed: true,
      teamAssignments: {
        select: {
          teamOrder: true,
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
  })

  if (!slot) {
    return null
  }

  return {
    ...slot,
    fanImageStatus: normalizeFanImageStatus(slot.fanImageStatus),
  }
}

export async function saveParticipantSourcePhoto(
  slotId: string,
  input: { photoMimeType: string; photoData: Uint8Array<ArrayBufferLike> },
) {
  const prisma = getPrismaClient()
  return prisma.drawSlot.update({
    where: { id: slotId },
    data: {
      photoMimeType: input.photoMimeType,
      photoData: toStoredBytes(input.photoData),
      generatedImageMimeType: null,
      neutralImageData: null,
      ecstaticImageData: null,
      devastatedImageData: null,
      fanImageStatus: 'idle',
      fanImageError: null,
      fanImageTeamId: null,
      fanImageGeneratedAt: null,
    },
    select: { id: true },
  })
}

export async function markParticipantFanImagesPending(slotId: string, teamId: string) {
  const prisma = getPrismaClient()
  return prisma.drawSlot.update({
    where: { id: slotId },
    data: {
      fanImageStatus: 'pending',
      fanImageError: null,
      fanImageTeamId: teamId,
    },
    select: { id: true },
  })
}

export async function saveParticipantFanImages(
  slotId: string,
  input: {
    generatedImageMimeType: string
    teamId: string
    neutral: Uint8Array<ArrayBufferLike>
    ecstatic: Uint8Array<ArrayBufferLike>
    devastated: Uint8Array<ArrayBufferLike>
  },
) {
  const prisma = getPrismaClient()
  return prisma.drawSlot.update({
    where: { id: slotId },
    data: {
      generatedImageMimeType: input.generatedImageMimeType,
      neutralImageData: toStoredBytes(input.neutral),
      ecstaticImageData: toStoredBytes(input.ecstatic),
      devastatedImageData: toStoredBytes(input.devastated),
      fanImageStatus: 'ready',
      fanImageError: null,
      fanImageTeamId: input.teamId,
      fanImageGeneratedAt: new Date(),
    },
    select: { id: true },
  })
}

export async function markParticipantFanImagesFailed(slotId: string, message: string, teamId: string | null) {
  const prisma = getPrismaClient()
  return prisma.drawSlot.update({
    where: { id: slotId },
    data: {
      fanImageStatus: 'failed',
      fanImageError: message,
      fanImageTeamId: teamId,
    },
    select: { id: true },
  })
}

export async function loadParticipantImageBytes(
  slotId: string,
  kind: FanImageKind | 'source',
): Promise<ParticipantImageReadResult> {
  const prisma = getPrismaClient()

  if (kind === 'source') {
    const slot = await prisma.drawSlot.findUnique({
      where: { id: slotId },
      select: {
        photoData: true,
        photoMimeType: true,
      },
    })

    if (!slot) {
      return { status: 'missing-slot' }
    }

    if (!slot.photoData) {
      return { status: 'missing-image' }
    }

    return {
      status: 'ready',
      bytes: slot.photoData,
      mimeType: slot.photoMimeType || 'image/jpeg',
    }
  }

  if (kind === 'neutral') {
    const slot = await prisma.drawSlot.findUnique({
      where: { id: slotId },
      select: {
        generatedImageMimeType: true,
        neutralImageData: true,
      },
    })

    if (!slot) {
      return { status: 'missing-slot' }
    }

    if (!slot.neutralImageData) {
      return { status: 'missing-image' }
    }

    return {
      status: 'ready',
      bytes: slot.neutralImageData,
      mimeType: slot.generatedImageMimeType || 'image/jpeg',
    }
  }

  if (kind === 'ecstatic') {
    const slot = await prisma.drawSlot.findUnique({
      where: { id: slotId },
      select: {
        generatedImageMimeType: true,
        ecstaticImageData: true,
      },
    })

    if (!slot) {
      return { status: 'missing-slot' }
    }

    if (!slot.ecstaticImageData) {
      return { status: 'missing-image' }
    }

    return {
      status: 'ready',
      bytes: slot.ecstaticImageData,
      mimeType: slot.generatedImageMimeType || 'image/jpeg',
    }
  }

  const slot = await prisma.drawSlot.findUnique({
    where: { id: slotId },
    select: {
      generatedImageMimeType: true,
      devastatedImageData: true,
    },
  })

  if (!slot) {
    return { status: 'missing-slot' }
  }

  if (!slot.devastatedImageData) {
    return { status: 'missing-image' }
  }

  return {
    status: 'ready',
    bytes: slot.devastatedImageData,
    mimeType: slot.generatedImageMimeType || 'image/jpeg',
  }
}

export function readParticipantImageBytes(
  slot: ParticipantImageSlot,
  kind: FanImageKind | 'source',
) {
  if (kind === 'source') {
    return slot.photoData
      ? {
          bytes: slot.photoData,
          mimeType: slot.photoMimeType || 'image/jpeg',
        }
      : null
  }

  const key = `${kind}ImageData` as const
  const bytes = slot[key]

  if (!bytes) {
    return null
  }

  return {
    bytes,
    mimeType: slot.generatedImageMimeType || 'image/jpeg',
  }
}
