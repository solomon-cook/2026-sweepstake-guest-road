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
  flagCode?: string | null,
  bytes?: Uint8Array<ArrayBufferLike> | null,
  mimeType?: string | null,
) {
  const dataUrl = buildFlagDataUrl(bytes, mimeType)

  if (dataUrl) {
    return dataUrl
  }

  if (!flagCode) {
    return undefined
  }

  return `https://flagcdn.com/w320/${flagCode}.png`
}
