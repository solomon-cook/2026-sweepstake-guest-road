export function buildFlagDataUrl(
  bytes?: Uint8Array<ArrayBufferLike> | null,
  mimeType?: string | null,
) {
  if (!bytes?.byteLength) {
    return undefined
  }

  return `data:${mimeType || 'image/jpeg'};base64,${Buffer.from(bytes).toString('base64')}`
}

export function buildFlagImageUrl(
  teamId?: string | null,
  flagCode?: string | null,
  version?: string | number | Date | null,
) {
  if (teamId) {
    const versionValue = version instanceof Date ? version.getTime() : version
    const query = versionValue ? `?v=${encodeURIComponent(String(versionValue))}` : ''

    return `/api/team-flags/${encodeURIComponent(teamId)}${query}`
  }

  if (!flagCode) {
    return undefined
  }

  return `https://flagcdn.com/w320/${flagCode}.png`
}
