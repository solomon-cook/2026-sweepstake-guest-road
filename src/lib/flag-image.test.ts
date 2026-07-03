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

  test('builds the cached team flag route for seeded teams', () => {
    expect(buildFlagImageUrl('team-1', 'gb-eng')).toBe('/api/team-flags/team-1')
  })

  test('adds an immutable cache-busting version when supplied', () => {
    expect(buildFlagImageUrl('team-1', 'gb-eng', new Date('2026-06-01T12:00:00.000Z'))).toBe(
      '/api/team-flags/team-1?v=1780315200000',
    )
  })

  test('falls back to the external flag URL when a team id is missing', () => {
    expect(buildFlagImageUrl(null, 'gb-eng')).toBe('https://flagcdn.com/w320/gb-eng.png')
  })
})
