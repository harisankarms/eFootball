import { describe, expect, it } from 'vitest'
import {
  buildTable,
  headToHead,
  outcomeFor,
  pastWeeks,
  playerSummary,
  rivalries,
  trophyCounts,
  weekResult,
  winnerOf,
} from './stats'
import { DEFAULT_SETTINGS, type Match } from './types'

const S = DEFAULT_SETTINGS // 3 per win, 1 per draw, 0.5 per goal, 1 per clean sheet, min 3 games
let seq = 0

function mk(
  home: string,
  away: string,
  hg: number,
  ag: number,
  opts: Partial<Match> & { at?: string } = {},
): Match {
  seq++
  const at = opts.at ?? new Date(Date.UTC(2026, 9, 20, 12, seq)).toISOString() // Tue 20 Oct 2026
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

describe('results', () => {
  it('gives the penalty shootout winner the win', () => {
    const m = mk('a', 'b', 2, 2, { pens_winner_id: 'b' })
    expect(outcomeFor(m, 'a')).toBe('L')
    expect(outcomeFor(m, 'b')).toBe('W')
    expect(winnerOf(m)).toBe('b')
    expect(winnerOf(mk('a', 'b', 1, 1))).toBeNull()
  })
})

describe('league table', () => {
  it('scores Player of the Week points from wins, draws, goals and clean sheets', () => {
    const rows = buildTable([mk('a', 'b', 3, 0), mk('b', 'a', 2, 2), mk('a', 'b', 1, 2)], S)
    const a = rows.find((r) => r.playerId === 'a')!
    expect(a).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, gf: 6, ga: 4, gd: 2, cleanSheets: 1 })
    // 3 (win) + 1 (draw) + 6 * 0.5 (goals) + 1 (clean sheet) = 8
    expect(a.points).toBe(8)
    expect(a.form).toEqual(['W', 'D', 'L'])
  })

  it('ignores disputed matches', () => {
    const rows = buildTable([mk('a', 'b', 3, 0), mk('a', 'b', 9, 0, { status: 'disputed' })], S)
    expect(rows.find((r) => r.playerId === 'a')!.gf).toBe(3)
  })

  it('does not count penalty shootout goals', () => {
    const rows = buildTable([mk('a', 'b', 1, 1, { pens_winner_id: 'a' })], S)
    const a = rows.find((r) => r.playerId === 'a')!
    expect(a).toMatchObject({ won: 1, gf: 1, ga: 1, cleanSheets: 0 })
  })

  it('keeps only the last five results in the form guide', () => {
    const ms = [3, 2, 1, 0, 0, 0, 0].map((g, i) => mk('a', 'b', g, i < 3 ? 0 : 1))
    expect(buildTable(ms, S).find((r) => r.playerId === 'a')!.form).toEqual(['W', 'L', 'L', 'L', 'L'])
  })

  it('breaks ties by win %, goal difference, goals, then head-to-head', () => {
    // Everyone with a win has 4.5 points. c has the best win %, and a and b are
    // level on everything except their meeting, which a won.
    const ms = [mk('a', 'b', 1, 0), mk('c', 'a', 1, 0), mk('b', 'd', 1, 0)]
    expect(buildTable(ms, S).map((r) => r.playerId)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('marks who has played enough games to qualify', () => {
    const rows = buildTable([mk('a', 'b', 1, 0), mk('a', 'c', 1, 0), mk('a', 'b', 1, 0)], S, 3)
    expect(rows.find((r) => r.playerId === 'a')).toMatchObject({ qualified: true, gamesNeeded: 0 })
    expect(rows.find((r) => r.playerId === 'b')).toMatchObject({ qualified: false, gamesNeeded: 1 })
  })
})

describe('Player of the Week', () => {
  it('only crowns someone who played the minimum number of games', () => {
    // b has more points but only 2 games, so a wins.
    const ms = [
      mk('b', 'c', 5, 0),
      mk('b', 'c', 5, 0),
      mk('a', 'c', 1, 0),
      mk('a', 'c', 1, 0),
      mk('a', 'd', 1, 1),
    ]
    const w = weekResult(ms, S, '2026-10-19')
    expect(w.rows[0].playerId).toBe('b')
    expect(w.winner?.playerId).toBe('a')
  })

  it('has no winner when nobody qualifies', () => {
    expect(weekResult([mk('a', 'b', 1, 0)], S, '2026-10-19').winner).toBeNull()
  })

  it('hands out weekly awards, sharing ties', () => {
    const ms = [
      mk('a', 'b', 4, 0),
      mk('a', 'c', 1, 0),
      mk('b', 'c', 3, 0),
      mk('b', 'c', 2, 2),
      mk('a', 'b', 0, 2),
      mk('c', 'a', 2, 2),
    ]
    const { awards } = weekResult(ms, S, '2026-10-19')
    expect(awards.goldenBoot).toEqual({ ids: ['a', 'b'], goals: 7 })
    expect(awards.biggestWin?.id).toBe(ms[0].id)
    expect(awards.wall?.cleanSheets).toBe(2)
    expect(awards.woodenSpoon?.playerId).toBe('c')
  })

  it('skips the wooden spoon when fewer than three people qualify', () => {
    const ms = [mk('a', 'b', 1, 0), mk('a', 'b', 1, 0), mk('a', 'b', 1, 0)]
    expect(weekResult(ms, S, '2026-10-19').awards.woodenSpoon).toBeNull()
  })

  it('builds the hall of fame from completed weeks only, newest first', () => {
    const lastWeek = (d: number) => new Date(Date.UTC(2026, 9, 13 + d, 12)).toISOString()
    const ms = [
      mk('a', 'b', 2, 0, { at: lastWeek(0) }),
      mk('a', 'b', 2, 0, { at: lastWeek(1) }),
      mk('a', 'b', 2, 0, { at: lastWeek(2) }),
      mk('b', 'a', 9, 0), // this week, still live
      mk('b', 'a', 9, 0, { at: '2026-10-01T12:00:00Z' }),
    ]
    const weeks = pastWeeks(ms, S, '2026-10-19')
    expect(weeks.map((w) => w.weekKey)).toEqual(['2026-10-12', '2026-09-28'])
    expect(weeks[0].winner?.playerId).toBe('a')
    expect(weeks[1].winner).toBeNull()
    expect(trophyCounts(weeks).get('a')?.potw).toBe(1)
    expect(trophyCounts(weeks).get('b')?.potw ?? 0).toBe(0)
  })
})

describe('player summary', () => {
  it('tracks streaks, biggest win, heaviest defeat and records against each opponent', () => {
    const ms = [
      mk('a', 'b', 1, 0),
      mk('a', 'c', 4, 1),
      mk('b', 'a', 0, 2),
      mk('a', 'b', 1, 1),
      mk('c', 'a', 3, 0),
      mk('a', 'c', 1, 0),
      mk('a', 'b', 2, 1),
    ]
    const s = playerSummary(ms, 'a')
    expect(s).toMatchObject({ played: 7, won: 5, drawn: 1, lost: 1, gf: 11, ga: 6, cleanSheets: 3 })
    expect(s.bestWinStreak).toBe(3)
    expect(s.bestUnbeatenRun).toBe(4)
    expect(s.currentStreak).toEqual({ outcome: 'W', count: 2 })
    expect(s.biggestWin?.id).toBe(ms[1].id)
    expect(s.heaviestDefeat?.id).toBe(ms[4].id)
    expect(s.opponents.find((o) => o.opponentId === 'b')).toMatchObject({ played: 4, won: 3, drawn: 1, lost: 0 })
  })
})

describe('head to head', () => {
  it('counts wins, goals and pens wins for both sides', () => {
    const ms = [
      mk('a', 'b', 3, 0),
      mk('b', 'a', 2, 1),
      mk('a', 'b', 1, 1, { pens_winner_id: 'b' }),
      mk('a', 'b', 0, 0),
      mk('a', 'c', 9, 0),
    ]
    const h = headToHead(ms, 'a', 'b')
    expect(h).toMatchObject({ aWins: 1, bWins: 2, draws: 1, aGoals: 5, bGoals: 3, bPensWins: 1, aCleanSheets: 2 })
    expect(h.matches).toHaveLength(4)
    expect(h.matches[0].id).toBe(ms[3].id)
    expect(h.aBiggestWin?.id).toBe(ms[0].id)
  })

  it('tracks streaks, form, the highest-scoring game and the first meeting', () => {
    const ms = [
      mk('a', 'b', 1, 0),
      mk('b', 'a', 4, 3),
      mk('a', 'b', 0, 2),
      mk('a', 'b', 1, 3),
      mk('a', 'c', 9, 9),
      mk('b', 'a', 1, 1),
      mk('b', 'a', 2, 2),
    ]
    const h = headToHead(ms, 'a', 'b')
    expect(h.played).toBe(6)
    expect(h.bLongestWinStreak).toBe(3)
    expect(h.aLongestWinStreak).toBe(1)
    expect(h.streak).toEqual({ side: 'draw', count: 2 })
    expect(h.aForm).toEqual(['L', 'L', 'L', 'D', 'D'])
    expect(h.bForm).toEqual(['W', 'W', 'W', 'D', 'D'])
    expect(h.highestScoring?.id).toBe(ms[1].id)
    expect(h.firstMeeting?.id).toBe(ms[0].id)
  })

  it('reports who is on a winning run', () => {
    const h = headToHead([mk('a', 'b', 0, 1), mk('a', 'b', 2, 0), mk('b', 'a', 0, 3)], 'a', 'b')
    expect(h.streak).toEqual({ side: 'a', count: 2 })
  })

  it('lists rivalries with the leader first, most-played first', () => {
    const ms = [
      mk('a', 'b', 0, 1),
      mk('b', 'a', 2, 0),
      mk('a', 'b', 1, 1),
      mk('c', 'a', 3, 0),
      mk('b', 'c', 1, 1, { status: 'disputed' }),
    ]
    const list = rivalries(ms)
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ a: 'b', b: 'a', played: 3, aWins: 2, bWins: 0, draws: 1 })
    expect(list[1]).toMatchObject({ a: 'c', b: 'a', played: 1, aWins: 1, bWins: 0 })
  })
})
