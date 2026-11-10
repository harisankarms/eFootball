import { describe, expect, it } from 'vitest'
import { findDuplicate } from './duplicates'
import type { Match } from './types'

const base = Date.UTC(2026, 10, 9, 18, 0)
const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString()

function mk(id: string, home: string, away: string, hg: number, ag: number, minutes: number): Match {
  return {
    id,
    played_at: at(minutes),
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
    created_at: at(minutes),
  }
}

const input = (home: string, away: string, hg: number, ag: number, minutes: number) => ({
  home_id: home,
  away_id: away,
  home_goals: hg,
  away_goals: ag,
  played_at: at(minutes),
})

describe('findDuplicate', () => {
  it('spots the same game logged by the other player, from their side', () => {
    const logged = [mk('m1', 'leo', 'ravi', 3, 1, 0)]
    expect(findDuplicate(logged, input('ravi', 'leo', 1, 3, 4))?.id).toBe('m1')
    expect(findDuplicate(logged, input('leo', 'ravi', 3, 1, 4))?.id).toBe('m1')
  })

  it('ignores a different score, different players, or the score the wrong way round', () => {
    const logged = [mk('m1', 'leo', 'ravi', 3, 1, 0)]
    expect(findDuplicate(logged, input('leo', 'ravi', 3, 2, 4))).toBeNull()
    expect(findDuplicate(logged, input('leo', 'anu', 3, 1, 4))).toBeNull()
    expect(findDuplicate(logged, input('leo', 'ravi', 1, 3, 4))).toBeNull()
  })

  it('only looks an hour either side', () => {
    const logged = [mk('m1', 'leo', 'ravi', 1, 0, 0)]
    expect(findDuplicate(logged, input('leo', 'ravi', 1, 0, 60))?.id).toBe('m1')
    expect(findDuplicate(logged, input('leo', 'ravi', 1, 0, 61))).toBeNull()
    expect(findDuplicate(logged, input('leo', 'ravi', 1, 0, -61))).toBeNull()
  })

  it('picks the closest when the same score happened twice that night', () => {
    const logged = [mk('early', 'leo', 'ravi', 1, 0, 0), mk('late', 'leo', 'ravi', 1, 0, 40)]
    expect(findDuplicate(logged, input('leo', 'ravi', 1, 0, 45))?.id).toBe('late')
  })
})
