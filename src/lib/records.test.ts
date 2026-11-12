import { describe, expect, it } from 'vitest'
import { newsworthy, recordBook } from './records'
import { DEFAULT_SETTINGS, type Match } from './types'

const S = { ...DEFAULT_SETTINGS, timezone: 'UTC' }
let seq = 0
/** A match on a given day (Mon 5 Oct 2026 is day 0), a minute apart within the day. */
function mk(day: number, home: string, away: string, hg: number, ag: number, opts: Partial<Match> = {}): Match {
  seq++
  const at = new Date(Date.UTC(2026, 9, 5 + day, 18, seq)).toISOString()
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
const NOW_WEEK = '2026-11-02'

describe('records', () => {
  it('keeps the biggest win, most goals and highest-scoring game, first to set it holding a tie', () => {
    const big = mk(0, 'a', 'b', 5, 1)
    const book = recordBook([big, mk(1, 'b', 'a', 4, 0), mk(2, 'c', 'a', 4, 4)], S, NOW_WEEK)
    expect(book.current.get('biggest-win')).toMatchObject({ holder: 'a', value: 4, match: big })
    expect(book.current.get('most-goals-game')).toMatchObject({ holder: 'a', value: 5 })
    expect(book.current.get('highest-scoring')).toMatchObject({ holder: 'c', value: 8 })
  })

  it('tracks runs, counts a run that keeps going as one entry, and knows when it is still going', () => {
    const ms = [mk(0, 'b', 'c', 1, 0), mk(0, 'b', 'c', 1, 0), mk(1, 'a', 'c', 1, 0), mk(2, 'a', 'c', 2, 0), mk(3, 'a', 'b', 3, 0)]
    const book = recordBook(ms, S, NOW_WEEK)
    expect(book.current.get('win-streak')).toMatchObject({ holder: 'a', value: 3 })
    expect(book.live.has('win-streak')).toBe(true)
    const wins = book.breaks.filter((b) => b.key === 'win-streak')
    expect(wins.map((b) => [b.mark.holder, b.mark.value])).toEqual([
      ['b', 2],
      ['a', 3],
    ])
    expect(wins[1].previous).toMatchObject({ holder: 'b', value: 2 })
    expect(book.current.get('losing-run')).toMatchObject({ holder: 'c', value: 4 })
    // c lost all four games and hasn't played since, so that run is still going.
    expect(book.live.has('losing-run')).toBe(true)
    expect(recordBook([...ms, mk(4, 'b', 'a', 1, 0)], S, NOW_WEEK).live.has('win-streak')).toBe(false)
  })

  it('sets weekly records once the week is over, and counts crowns in a row', () => {
    const wk1 = [mk(0, 'a', 'b', 3, 0), mk(0, 'a', 'b', 2, 0), mk(1, 'a', 'b', 1, 0)]
    const wk2 = [mk(7, 'a', 'b', 1, 0), mk(7, 'a', 'b', 1, 0), mk(8, 'a', 'b', 1, 0)]
    const thisWeek = [mk(28, 'b', 'a', 9, 0)]
    const book = recordBook([...wk1, ...wk2, ...thisWeek], S, NOW_WEEK)
    expect(book.current.get('potw-crowns')).toMatchObject({ holder: 'a', value: 2 })
    expect(book.current.get('potw-row')).toMatchObject({ holder: 'a', value: 2, weekKey: '2026-10-12' })
    expect(book.current.get('week-goals')).toMatchObject({ holder: 'a', value: 6, weekKey: '2026-10-05' })
    // Set when week one ended: Monday 12 Oct at midnight.
    expect(book.current.get('week-goals')!.at).toBe('2026-10-12T00:00:00.000Z')
    // This week's 9-goal game counts for single games but not (yet) for the week.
    expect(book.current.get('most-goals-game')).toMatchObject({ holder: 'b', value: 9 })
  })

  it('leaves disputed results out', () => {
    const book = recordBook([mk(0, 'a', 'b', 1, 0), mk(1, 'b', 'a', 7, 0, { status: 'disputed' })], S, NOW_WEEK)
    expect(book.current.get('biggest-win')).toMatchObject({ holder: 'a', value: 1 })
  })

  it('only puts records in the news when they replace one that stood for a day', () => {
    const ms = [mk(0, 'a', 'b', 2, 0), mk(0, 'b', 'a', 3, 0), mk(3, 'a', 'b', 6, 0)]
    const book = recordBook(ms, S, NOW_WEEK)
    const news = newsworthy(book).filter((b) => b.key === 'biggest-win')
    expect(news).toHaveLength(1)
    expect(news[0].mark.value).toBe(6)
    expect(news[0].previous).toMatchObject({ holder: 'b', value: 3 })
  })
})
