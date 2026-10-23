import { describe, expect, it } from 'vitest'
import { gameNameOwner, nameSimilarity } from './matchStats'
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
