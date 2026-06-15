import { describe, expect, test } from 'vitest'
import { buildFlagDataUrl, buildFlagImageUrl } from './flag-image'

describe('flag image helpers', () => {
  test('builds a data URL from persisted database bytes', () => {
    expect(buildFlagDataUrl(Buffer.from('flag-bytes'), 'image/png')).toBe(
      `data:image/png;base64,${Buffer.from('flag-bytes').toString('base64')}`,
    )
  })

  test('defaults persisted database bytes to jpeg when no MIME type is stored', () => {
    expect(buildFlagDataUrl(Buffer.from('flag-bytes'), null)).toBe(
      `data:image/jpeg;base64,${Buffer.from('flag-bytes').toString('base64')}`,
    )
  })

  test('falls back to the external flag URL when database bytes are missing', () => {
    expect(buildFlagImageUrl('gb-eng', null, 'image/png')).toBe('https://flagcdn.com/w320/gb-eng.png')
  })
})
