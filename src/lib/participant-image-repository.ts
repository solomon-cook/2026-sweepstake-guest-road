import { getPrismaClient } from './prisma'
import type { FanImageKind, FanImageStatus, TeamScore } from './types'

export const ALLOWED_PARTICIPANT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
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
