import { describe, expect, it } from 'vitest'
import { isCounted } from './stats'
import { formatSummary, gamesInTotal, leagueFixtures, stageFor, tournamentState, tournamentStats } from './tournaments'
import type { Match, Stage, Tournament } from './types'

const cup = (players: string[], rounds: 1 | 2 = 1, knockout: 0 | 2 | 4 | 8 = 4): Tournament => ({
  id: 't1',
  name: 'Cup',
  league_rounds: rounds,
  knockout_size: knockout,
  counts_in_stats: true,
  created_by: null,
  created_at: '2026-10-20T00:00:00Z',
  players,
})

let seq = 0
const game = (home: string, away: string, hg: number, ag: number, stage: Stage = 'league', extra: Partial<Match> = {}): Match => {
  seq++
  const at = new Date(Date.UTC(2026, 9, 20, 0, seq)).toISOString()
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
    tournament_id: 't1',
    stage,
    in_stats: true,
    ...extra,
  }
}

describe('league fixtures', () => {
  it('pairs everyone once per round, in matchdays', () => {
    const f = leagueFixtures(cup(['a', 'b', 'c', 'd']))
    expect(f).toHaveLength(6)
    expect(new Set(f.map((x) => [x.home, x.away].sort().join())).size).toBe(6)
    expect(Math.max(...f.map((x) => x.round))).toBe(3)
    for (const round of [1, 2, 3]) expect(new Set(f.filter((x) => x.round === round).flatMap((x) => [x.home, x.away])).size).toBe(4)
  })

  it('gives a rest each matchday with an odd number, and swaps home and away the second time round', () => {
    const f = leagueFixtures(cup(['a', 'b', 'c', 'd', 'e'], 2))
    expect(f).toHaveLength(20)
    const ab = f.filter((x) => [x.home, x.away].sort().join() === 'a,b')
    expect(ab).toHaveLength(2)
    expect(ab[0].home).toBe(ab[1].away)
  })
})

describe('a tournament from league to final', () => {
  const t = cup(['a', 'b', 'c', 'd'])
  const league = [
    game('a', 'b', 2, 0),
    game('c', 'd', 1, 1),
    game('a', 'c', 3, 1),
    game('b', 'd', 0, 2),
    game('a', 'd', 1, 0),
    game('b', 'c', 2, 2),
  ]

  it('builds the table and lists what is left to play', () => {
    const s = tournamentState(t, league.slice(0, 4))
    expect(s.phase).toBe('league')
    expect(s.leagueDone).toBe(false)
    expect(s.open).toHaveLength(2)
    expect(s.table[0]).toMatchObject({ playerId: 'a', played: 2, won: 2, points: 6, gd: 4 })
    expect(s.rounds[0].ties[0]).toMatchObject({ a: null, b: null, aFrom: '1st', bFrom: '4th' })
  })

  it('seeds the semi-finals 1st v 4th and 2nd v 3rd once the league is done', () => {
    const s = tournamentState(t, league)
    expect(s.table.map((r) => r.playerId)).toEqual(['a', 'd', 'c', 'b'])
    expect(s.phase).toBe('sf')
    expect(s.rounds[0].ties.map((x) => [x.a, x.b])).toEqual([
      ['a', 'b'],
      ['d', 'c'],
    ])
    expect(stageFor(s, 'b', 'a')).toBe('sf')
    expect(stageFor(s, 'a', 'd')).toBeNull()
  })

  it('settles knockout draws on penalties and crowns the final winner', () => {
    const knockouts = [game('a', 'b', 1, 1, 'sf', { pens_winner_id: 'b' }), game('d', 'c', 3, 0, 'sf')]
    const semis = tournamentState(t, [...league, ...knockouts])
    expect(semis.rounds[1].ties[0]).toMatchObject({ a: 'b', b: 'd', aFrom: 'Winner SF1', bFrom: 'Winner SF2' })
    expect(semis.phase).toBe('final')
    const done = tournamentState(t, [...league, ...knockouts, game('d', 'b', 2, 1, 'final')])
    expect(done.champion).toBe('d')
    expect(done.phase).toBe('finished')
    expect(done.open).toEqual([])
  })

  it('ignores extra league games, disputed results and other tournaments', () => {
    const noise = [game('a', 'b', 0, 9), game('c', 'd', 9, 0, 'league', { status: 'disputed' }), game('a', 'c', 0, 5, 'league', { tournament_id: 't2' })]
    const s = tournamentState(t, [...league, ...noise])
    expect(s.table.find((r) => r.playerId === 'a')).toMatchObject({ played: 3, points: 9 })
    expect(s.matches).toHaveLength(7)
  })

  it('crowns the top of the table when there are no knockouts', () => {
    const s = tournamentState(cup(['a', 'b', 'c', 'd'], 1, 0), league)
    expect(s.champion).toBe('a')
    expect(s.phase).toBe('finished')
  })

  it('keeps its own stats', () => {
    const s = tournamentState(t, league)
    const stats = tournamentStats(t, s)
    expect(stats.topScorers[0]).toEqual({ playerId: 'a', goals: 6 })
    expect(stats.cleanSheets[0]).toEqual({ playerId: 'a', count: 2 })
    expect(stats.biggestWin?.home_goals).toBe(3)
  })
})

describe('tournaments and the main stats', () => {
  it('leaves out results of tournaments kept apart', () => {
    expect(isCounted(game('a', 'b', 1, 0))).toBe(true)
    expect(isCounted(game('a', 'b', 1, 0, 'league', { in_stats: false }))).toBe(false)
  })

  it('describes the format and how many games it takes', () => {
    expect(formatSummary({ league_rounds: 2, knockout_size: 4 })).toBe('Round robin (twice), then semi-finals and a final')
    expect(formatSummary({ league_rounds: 1, knockout_size: 0 })).toBe('Round robin, top of the table wins')
    expect(gamesInTotal({ league_rounds: 1, knockout_size: 4 }, 6)).toBe(18)
  })
})
