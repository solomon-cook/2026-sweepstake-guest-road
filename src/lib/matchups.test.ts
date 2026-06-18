import { describe, expect, test } from 'vitest'
import { buildParticipantSlotUpdate, toPersistedDraw } from './draw-repository'
import {
  buildMatchups,
  calculateLocalMatchOdds,
  normalizeTeamName,
  selectMatchupOwnerPhoto,
  selectDisplayFixtures,
  selectPreviousFixtures,
} from './matchups'
import { TEAM_SEED_SCORES } from './team-source'
import type { MatchFixture, PersistedDraw } from './types'

function makeDraw(): PersistedDraw {
  const [france, spain, england] = TEAM_SEED_SCORES

  return toPersistedDraw(7, [
    {
      id: 'slot-france',
      slotIndex: 0,
      playerName: 'Sam',
      photoMimeType: 'image/jpeg',
      photoData: Buffer.from('photo'),
      generatedImageMimeType: 'image/jpeg',
      neutralImageData: Buffer.from('neutral'),
      ecstaticImageData: Buffer.from('ecstatic'),
      devastatedImageData: Buffer.from('devastated'),
      fanImageStatus: 'ready',
      fanImageTeamId: france.id,
      totalScore: 14,
      isRevealed: true,
      teamAssignments: [{ teamOrder: 0, team: france }],
    },
    {
      id: 'slot-spain',
      slotIndex: 1,
      playerName: 'Dan',
      totalScore: 13,
      isRevealed: false,
      teamAssignments: [
        { teamOrder: 0, team: spain },
        { teamOrder: 1, team: england },
      ],
    },
  ])
}

function fixture(overrides: Partial<MatchFixture>): MatchFixture {
  return {
    id: 'fixture-1',
    startsAt: '2026-06-14T19:00:00+00:00',
    status: 'upcoming',
    statusLabel: 'Not Started',
    homeTeam: 'France',
    awayTeam: 'Spain',
    ...overrides,
  }
}

describe('matchup mapping', () => {
  test('normalizes API team names for owner lookup', () => {
    expect(normalizeTeamName('Curaçao')).toBe('curacao')
    expect(normalizeTeamName('Bosnia & Herzegovina')).toBe('bosniaandherzegovina')
    expect(normalizeTeamName('Bosnia-Herzegovina')).toBe('bosniaandherzegovina')
    expect(normalizeTeamName('Czechia')).toBe('czechrepublic')
    expect(normalizeTeamName('Türkiye')).toBe('turkey')
    expect(normalizeTeamName('USA')).toBe('unitedstates')
    expect(normalizeTeamName('DR Congo')).toBe('drcongo')
    expect(normalizeTeamName('Congo DR')).toBe('drcongo')
    expect(normalizeTeamName('Democratic Republic of the Congo')).toBe('drcongo')
  })

  test('maps fixtures to existing draw owners without mutating allocation data', () => {
    const draw = makeDraw()
    const [france, spain] = TEAM_SEED_SCORES
    const before = structuredClone(draw)
    const result = buildMatchups(draw, [fixture({})], {
      'fixture-1': { home: '2.10', draw: '3.20', away: '3.60', source: 'Book' },
    })

    expect(result.matchups[0].home).toMatchObject({
      ownerName: 'Sam',
      teamName: 'France',
      teamRank: france.rank,
      isAssigned: true,
    })
    expect(result.matchups[0].away).toMatchObject({
      ownerName: 'Dan',
      teamName: 'Spain',
      teamRank: spain.rank,
      isAssigned: true,
    })
    expect(result.matchups[0].odds?.home).toBe('2.10')
    expect(draw).toEqual(before)
  })

  test('matches Congo DR fixtures to the existing DR Congo allocation', () => {
    const draw = toPersistedDraw(7, [
      {
        id: 'slot-dr-congo',
        slotIndex: 0,
        playerName: 'Pat',
        totalScore: 10,
        isRevealed: true,
        teamAssignments: [
          {
            teamOrder: 0,
            team: TEAM_SEED_SCORES.find((team) => team.name === 'DR Congo')!,
          },
        ],
      },
    ])

    const result = buildMatchups(
      draw,
      [fixture({ homeTeam: 'Congo DR', awayTeam: 'France' })],
      {},
    )

    expect(result.matchups[0].home).toMatchObject({
      ownerName: 'Pat',
      teamName: 'DR Congo',
      isAssigned: true,
    })
    expect(result.warnings).not.toContain('No sweepstake owner found for Congo DR.')
  })

  test('matches Czechia fixtures to the existing Czech Republic allocation', () => {
    const draw = toPersistedDraw(7, [
      {
        id: 'slot-czech',
        slotIndex: 0,
        playerName: 'Callum',
        totalScore: 10,
        isRevealed: true,
        teamAssignments: [
          {
            teamOrder: 0,
            team: TEAM_SEED_SCORES.find((team) => team.name === 'Czech Republic')!,
          },
        ],
      },
    ])

    const result = buildMatchups(
      draw,
      [fixture({ homeTeam: 'Czechia', awayTeam: 'France' })],
      {},
    )

    expect(result.matchups[0].home).toMatchObject({
      ownerName: 'Callum',
      teamName: 'Czech Republic',
      isAssigned: true,
    })
    expect(result.warnings).not.toContain('No sweepstake owner found for Czechia.')
  })

  test('matches Bosnia-Herzegovina fixtures to the existing Bosnia and Herzegovina allocation', () => {
    const draw = toPersistedDraw(7, [
      {
        id: 'slot-bosnia',
        slotIndex: 0,
        playerName: 'Alex',
        totalScore: 10,
        isRevealed: true,
        teamAssignments: [
          {
            teamOrder: 0,
            team: TEAM_SEED_SCORES.find((team) => team.name === 'Bosnia and Herzegovina')!,
          },
        ],
      },
    ])

    const result = buildMatchups(
      draw,
      [fixture({ homeTeam: 'Bosnia-Herzegovina', awayTeam: 'France' })],
      {},
    )

    expect(result.matchups[0].home).toMatchObject({
      ownerName: 'Alex',
      teamName: 'Bosnia and Herzegovina',
      isAssigned: true,
    })
    expect(result.warnings).not.toContain('No sweepstake owner found for Bosnia-Herzegovina.')
  })

  test('calculates matchup odds from persisted team scores when no external odds exist', () => {
    const result = buildMatchups(makeDraw(), [fixture({})], {})
    const matchup = result.matchups[0]
    const expectedHomeProbability =
      (matchup.home.teamScore ?? 0) / ((matchup.home.teamScore ?? 0) + (matchup.away.teamScore ?? 0))

    expect(matchup.odds?.source).toBe('Calculated from sweepstake scores')
    expect(matchup.odds?.homeProbability).toBeCloseTo(expectedHomeProbability, 6)
    expect(matchup.odds?.awayProbability).toBeCloseTo(1 - expectedHomeProbability, 6)
    expect(Number(matchup.odds?.home)).toBeCloseTo(1 / expectedHomeProbability, 2)
    expect(matchup.odds?.draw).toBeNull()
  })

  test('does not calculate local odds if either side is unassigned', () => {
    const result = buildMatchups(makeDraw(), [fixture({ awayTeam: 'Atlantis' })], {})

    expect(result.matchups[0].odds).toBeNull()
  })

  test('calculates local odds directly from side scores', () => {
    const odds = calculateLocalMatchOdds(
      {
        teamName: 'A',
        ownerName: 'Owner A',
        teamScore: 3,
        isAssigned: true,
      },
      {
        teamName: 'B',
        ownerName: 'Owner B',
        teamScore: 1,
        isAssigned: true,
      },
    )

    expect(odds).toMatchObject({
      home: '1.33',
      away: '4.00',
      homeProbability: 0.75,
      awayProbability: 0.25,
    })
  })

  test('returns non-fatal warnings for teams that are not in the persisted draw', () => {
    const result = buildMatchups(makeDraw(), [fixture({ awayTeam: 'Atlantis' })], {})

    expect(result.matchups[0].away).toMatchObject({
      ownerName: 'Unassigned',
      teamName: 'Atlantis',
      isAssigned: false,
    })
    expect(result.warnings).toContain('No sweepstake owner found for Atlantis.')
  })

  test('selects live fixtures first, then upcoming fixtures', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const inTwoDays = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const selected = selectDisplayFixtures([
      fixture({ id: 'later', startsAt: inTwoDays }),
      fixture({ id: 'live', status: 'live', startsAt: tomorrow }),
      fixture({ id: 'soon', startsAt: tomorrow }),
    ])

    expect(selected.map((item) => item.id)).toEqual(['live', 'soon', 'later'])
  })

  test('keeps current-day scheduled fixtures even if kickoff has passed', () => {
    const today = new Date().toISOString().slice(0, 10)
    const selected = selectDisplayFixtures([
      fixture({
        id: 'today-earlier',
        startsAt: `${today}T00:01:00.000Z`,
        status: 'upcoming',
      }),
    ])

    expect(selected.map((item) => item.id)).toEqual(['today-earlier'])
  })

  test('selects previous fixtures newest first', () => {
    const selected = selectPreviousFixtures([
      fixture({ id: 'upcoming', status: 'upcoming', startsAt: '2026-06-16T12:00:00.000Z' }),
      fixture({ id: 'older', status: 'finished', startsAt: '2026-06-12T12:00:00.000Z' }),
      fixture({ id: 'newer', status: 'finished', startsAt: '2026-06-13T12:00:00.000Z' }),
    ])

    expect(selected.map((item) => item.id)).toEqual(['newer', 'older'])
  })
})

describe('participant profile updates', () => {
  test('builds profile-only update data for names and photos', () => {
    const update = buildParticipantSlotUpdate(
      {
        slotId: 'slot-france',
        playerName: '  New Name  ',
        photoMimeType: 'image/jpeg',
        photoDataBase64: Buffer.from('small-photo').toString('base64'),
      },
      0,
    )

    expect(update.playerName).toBe('New Name')
    expect(update.photoMimeType).toBe('image/jpeg')
    expect(Buffer.from(update.photoData ?? []).toString()).toBe('small-photo')
    expect(Object.keys(update).sort()).toEqual(['photoData', 'photoMimeType', 'playerName'])
  })

  test('rejects oversized database photos', () => {
    expect(() =>
      buildParticipantSlotUpdate(
        {
          slotId: 'slot-france',
          photoMimeType: 'image/jpeg',
          photoDataBase64: Buffer.alloc((2 * 1024 * 1024) + 1).toString('base64'),
        },
        0,
      ),
    ).toThrow('2MB')
  })

  test('selects the correct matchup photo variant without changing ownership', () => {
    const draw = makeDraw()
    const before = structuredClone(draw)
    const side = buildMatchups(draw, [fixture({ status: 'finished', homeScore: 2, awayScore: 0 })], {}).matchups[0].home

    expect(selectMatchupOwnerPhoto(side, 2, 0)).toBe('/api/participants/slot-france/images/ecstatic')
    expect(selectMatchupOwnerPhoto(side, 0, 2)).toBe('/api/participants/slot-france/images/devastated')
    expect(selectMatchupOwnerPhoto(side, 1, 1)).toBe('/api/participants/slot-france/images/neutral')
    expect(draw).toEqual(before)
  })
})
