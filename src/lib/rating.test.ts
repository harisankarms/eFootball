import { describe, expect, it } from 'vitest'
import { START_RATING, changeSince, expectedScore, formatChange, marginWeight, ratings } from './rating'
import type { Match } from './types'

let seq = 0
function mk(home: string, away: string, hg: number, ag: number, opts: Partial<Match> = {}): Match {
  seq++
  const at = new Date(Date.UTC(2026, 9, 20, 12, seq)).toISOString()
  return {
    id: `m${seq}`,
    played_at: at,
    home_id: home,
    away_id: away,
    home_goals: hg,
    away_goals: ag,
    pens_winner_id: null,
    home_team: null,
    away_team: null,
    notes: null,
    screenshot_path: null,
    thumb_path: null,
    submitted_by: home,
    status: 'ok',
    dispute_reason: null,
    disputed_by: null,
    created_at: at,
    ...opts,
  }
}

describe('form rating', () => {
  it('moves 16 points between two new players after a one-goal win', () => {
    const r = ratings([mk('a', 'b', 2, 1)])
    expect(r.current.get('a')).toBe(START_RATING + 16)
    expect(r.current.get('b')).toBe(START_RATING - 16)
    expect(r.rank.get('a')).toBe(1)
    expect(r.rank.get('b')).toBe(2)
  })

  it('never creates or loses points overall', () => {
    const r = ratings([mk('a', 'b', 3, 0), mk('b', 'c', 1, 1), mk('c', 'a', 2, 0), mk('a', 'c', 4, 2)])
    const total = [...r.current.values()].reduce((s, n) => s + n, 0)
    expect(total).toBeCloseTo(3 * START_RATING, 6)
  })

  it('gives more for beating a stronger player than a weaker one', () => {
    // a beats b twice, so a is rated higher than c and b is rated lower.
    const base = [mk('a', 'b', 1, 0), mk('a', 'b', 1, 0)]
    const beatStrong = ratings([...base, mk('c', 'a', 1, 0)]).history.get('c')!.at(-1)!.change
    const beatWeak = ratings([...base, mk('c', 'b', 1, 0)]).history.get('c')!.at(-1)!.change
    expect(beatStrong).toBeGreaterThan(16)
    expect(beatWeak).toBeLessThan(16)
  })

  it('counts a bigger win for a bit more', () => {
    expect(marginWeight(1)).toBe(1)
    expect(marginWeight(-2)).toBe(1.5)
    expect(marginWeight(3)).toBe(1.75)
    expect(ratings([mk('a', 'b', 4, 0)]).current.get('a')).toBe(START_RATING + 16 * marginWeight(4))
  })

  it('moves a draw towards the lower-rated player, and leaves equal players alone', () => {
    expect(ratings([mk('a', 'b', 1, 1)]).current.get('a')).toBe(START_RATING)
    const r = ratings([mk('a', 'b', 1, 0), mk('a', 'b', 2, 2)])
    const draw = r.history.get('b')!.at(-1)!
    expect(draw.outcome).toBe('D')
    expect(draw.change).toBeGreaterThan(0)
  })

  it('gives the shootout winner the win and skips disputed results', () => {
    const r = ratings([mk('a', 'b', 1, 1, { pens_winner_id: 'b' }), mk('a', 'b', 5, 0, { status: 'disputed' })])
    expect(r.current.get('b')).toBe(START_RATING + 16)
    expect(r.history.get('a')).toHaveLength(1)
  })

  it('keeps each player’s peak and the change over a period', () => {
    const r = ratings([mk('a', 'b', 1, 0), mk('b', 'a', 1, 0), mk('b', 'a', 1, 0)])
    expect(r.peak.get('a')!.rating).toBe(START_RATING + 16)
    expect(r.peak.get('b')!.rating).toBeGreaterThan(START_RATING)
    const a = r.history.get('a')!
    expect(changeSince(a, 0)).toBeCloseTo(r.current.get('a')! - START_RATING, 6)
    expect(changeSince(a, Date.parse(a[1].match.played_at))).toBeCloseTo(a[1].change + a[2].change, 6)
  })

  it('works out expected scores and formats changes', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5)
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 6)
    expect(formatChange(12.4)).toBe('+12')
    expect(formatChange(-7.6)).toBe('−8')
    expect(formatChange(0.2)).toBe('±0')
  })
})
