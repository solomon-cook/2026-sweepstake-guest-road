export function buildFlagImageUrl(flagCode?: string | null) {
  if (!flagCode) {
    return undefined
  }

  return `https://flagcdn.com/w320/${flagCode}.png`
}
