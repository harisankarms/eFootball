import { describe, expect, it } from 'vitest'
import { gameNameOwner, meetingStats, nameSimilarity, playerStats, sidesOf, statLeaders, type MatchStats } from './matchStats'
import type { Match, Player } from './types'

const player = (id: string, name: string, active = true) => ({ id, name, active }) as Player
const match = (home: string, away: string, names: [string | null, string | null] | null, playedAt: string) =>
  ({ home_id: home, away_id: away, played_at: playedAt, details: names ? { names } : null }) as Match

describe('in-game names', () => {
  it('treats names that differ by an OCR slip as the same', () => {
    expect(nameSimilarity('Unnal Mudivath Thambi', 'Unnal Mudiyath Thambi')).toBeGreaterThan(0.9)
    expect(nameSimilarity('pray!', 'Pray')).toBe(1)
    expect(nameSimilarity('pray!', 'prey')).toBeLessThan(0.8)
  })

  it('never matches names it cannot compare', () => {
    expect(nameSimilarity('ദേവൻ', 'രാജു')).toBe(0)
    expect(nameSimilarity('ദേവൻ', 'ദേവൻ')).toBe(1)
  })

  it('learns who an in-game name belongs to from earlier screenshots, newest first', () => {
    const players = [player('a', 'Hari'), player('b', 'Goatzabu'), player('c', 'Sam')]
    const matches = [
      match('a', 'b', ['Unnal Mudiyath Thambi', 'pray!'], '2026-10-20T18:00:00Z'),
      match('c', 'b', ['pray!', 'Someone'], '2026-10-22T18:00:00Z'),
    ]
    expect(gameNameOwner('Unnal Mudivath Thambi', matches, players)).toBe('a')
    expect(gameNameOwner('pray!', matches, players)).toBe('c')
    expect(gameNameOwner('Stranger', matches, players)).toBeNull()
  })

  it('falls back to the players own names, and skips inactive players', () => {
    const players = [player('a', 'Hari'), player('b', 'Goatzabu', false)]
    expect(gameNameOwner('HARI', [], players)).toBe('a')
    expect(gameNameOwner('Goatzabu', [], players)).toBeNull()
  })
})

const played = (home: string, away: string, stats: MatchStats | null, status: Match['status'] = 'ok') =>
  ({ home_id: home, away_id: away, status, played_at: '2026-10-20T18:00:00Z', details: stats ? { stats } : null }) as Match

describe('screenshot stats', () => {
  const matches = [
    played('a', 'b', { possession: [60, 40], shots: [10, 4], shots_on_target: [6, 1], passes: [200, 120], successful_passes: [180, 90], tackles: [12, 20] }),
    played('b', 'a', { possession: [45, 55], shots: [8, 6], shots_on_target: [4, 3], passes: [150, 180], successful_passes: [120, 150] }),
    played('a', 'c', { possession: [50, 50], shots: [9, 9], shots_on_target: [5, 5] }),
    played('a', 'b', null),
    played('a', 'b', { possession: [90, 10] }, 'disputed'),
  ]

  it('takes each player their own side of a match', () => {
    expect(sidesOf(matches[1], 'a')).toEqual({
      mine: { possession: 55, shots: 6, shots_on_target: 3, passes: 180, successful_passes: 150 },
      theirs: { possession: 45, shots: 8, shots_on_target: 4, passes: 150, successful_passes: 120 },
    })
    expect(sidesOf(matches[3], 'a')).toBeNull()
  })

  it('averages each stat over the matches it was read in, leaving out disputed results', () => {
    const s = playerStats(matches, 'a')
    expect(s.matches).toBe(3)
    expect(s.avg.possession).toBe(55)
    expect(s.avg.shots).toBeCloseTo(25 / 3)
    expect(s.avg.tackles).toBe(12)
    expect(s.shotAccuracy).toBeCloseTo((14 / 25) * 100)
    expect(s.passAccuracy).toBeCloseTo((330 / 380) * 100)
  })

  it('compares two players over their meetings only', () => {
    const m = meetingStats(matches, 'a', 'b')
    expect(m.a.matches).toBe(2)
    expect(m.a.avg.possession).toBe(57.5)
    expect(m.b.avg.possession).toBe(42.5)
    expect(m.b.passAccuracy).toBeCloseTo((210 / 270) * 100)
  })

  it('crowns stat leaders, as long as they have enough matches with stats', () => {
    const leaders = statLeaders(matches)
    const passer = leaders.find((l) => l.title === 'Best passer')
    expect(passer?.playerId).toBe('a')
    expect(leaders.find((l) => l.title === 'Most tackles')?.playerId).toBe('b')

    // Eight more for b: c's single match is now under a quarter of b's ten, so c can't lead.
    const busy = [...matches, ...Array.from({ length: 8 }, () => played('b', 'a', { possession: [40, 60] }))]
    expect(statLeaders(busy).some((l) => l.playerId === 'c')).toBe(false)
  })
})
