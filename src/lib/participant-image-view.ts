import type { ParticipantImageSlot } from './participant-image-repository'

function buildParticipantImageUrl(slotId: string, kind: 'source' | 'neutral' | 'ecstatic' | 'devastated') {
  return `/api/participants/${encodeURIComponent(slotId)}/images/${kind}`
}

export function toParticipantImageResponse(slot: ParticipantImageSlot) {
  const topTeamName =
    slot.teamAssignments.find((assignment) => assignment.team.id === slot.fanImageTeamId)?.team.name ?? null

  return {
    slotId: slot.id,
    sourcePhotoUrl: slot.photoData && slot.photoMimeType ? buildParticipantImageUrl(slot.id, 'source') : null,
    fanImageStatus: slot.fanImageStatus,
    fanImageError: slot.fanImageError,
    fanImageTeamName: topTeamName,
    fanImageUrls:
      slot.neutralImageData || slot.ecstaticImageData || slot.devastatedImageData
        ? {
            neutral: slot.neutralImageData ? buildParticipantImageUrl(slot.id, 'neutral') : null,
            ecstatic: slot.ecstaticImageData ? buildParticipantImageUrl(slot.id, 'ecstatic') : null,
            devastated: slot.devastatedImageData ? buildParticipantImageUrl(slot.id, 'devastated') : null,
          }
        : null,
  }
}
