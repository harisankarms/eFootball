import { describe, expect, it } from 'vitest'
import { addSeasons, firstSeason, pastSeasons, seasonBounds, seasonKeyOf, seasonMinimum, seasonMonths, seasonName, seasonResult, seasonSpan } from './seasons'
import { weekResult } from './stats'
import { DEFAULT_SETTINGS, type Match } from './types'

const S = { ...DEFAULT_SETTINGS, timezone: 'UTC' }
let seq = 0
function mk(at: string, home: string, away: string, hg: number, ag: number): Match {
  seq++
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
  }
}

describe('seasons', () => {
  it('are the quarters of the year, numbered from the first', () => {
    expect(seasonKeyOf('2026-10-04T12:00:00Z', 'UTC')).toBe('2026-Q4')
    expect(seasonKeyOf('2026-12-31T20:00:00Z', 'Asia/Kolkata')).toBe('2027-Q1') // already 1 Jan in India
    expect(seasonMonths('2026-Q4')).toEqual(['2026-10', '2026-11', '2026-12'])
    expect(addSeasons('2026-Q4', 1)).toBe('2027-Q1')
    expect(addSeasons('2027-Q1', -1)).toBe('2026-Q4')
    expect(seasonSpan('2027-Q1')).toBe('Jan–Mar 2027')
    expect(seasonName('2027-Q2', '2026-Q4')).toBe('Season 3')
    expect(seasonBounds('2026-Q4', 'UTC')).toEqual({ start: new Date('2026-10-01T00:00:00Z'), end: new Date('2027-01-01T00:00:00Z') })
  })

  it('crowns the most points with enough games, and counts the season’s weekly crowns', () => {
    expect(seasonMinimum(S)).toBe(18)
    const games: Match[] = []
    // a plays 18 games (12 wins), b plays 10 (all wins, but too few games).
    for (let i = 0; i < 18; i++) games.push(mk(`2026-10-${String(5 + (i % 20)).padStart(2, '0')}T1${i % 10}:00:00Z`, 'a', 'c', i < 12 ? 2 : 0, i < 12 ? 0 : 1))
    for (let i = 0; i < 10; i++) games.push(mk(`2026-11-${String(2 + i).padStart(2, '0')}T12:00:00Z`, 'b', 'c', 5, 0))
    games.push(mk('2027-01-05T12:00:00Z', 'b', 'c', 1, 0))
    const week = weekResult(games.filter((m) => m.played_at.startsWith('2026-11-0')), S, '2026-11-02')
    const res = seasonResult(games, S, '2026-Q4', [week])
    expect(res.rows[0].playerId).toBe('b')
    expect(res.champion?.playerId).toBe('a')
    expect(res.matches).toHaveLength(28)
    expect(res.awards.goldenBoot?.ids).toEqual(['b'])
    expect(res.crowns.get(week.winner!.playerId)).toBe(1)
    expect(firstSeason(games, 'UTC')).toBe('2026-Q4')
    expect(pastSeasons(games, S, '2027-Q1').map((s) => s.key)).toEqual(['2026-Q4'])
  })
})
