import { describe, expect, it } from 'vitest'
import { challengeState, liveChallenges } from './challenges'
import { oracleTable, predictionWindow, rightGuesses } from './predictions'
import { weekResult } from './stats'
import { DEFAULT_SETTINGS, type Challenge, type Match, type Prediction } from './types'

const S = { ...DEFAULT_SETTINGS, timezone: 'UTC' }
let seq = 0
function mk(at: string, home: string, away: string, hg: number, ag: number, opts: Partial<Match> = {}): Match {
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
    ...opts,
  }
}
const challenge = (over: Partial<Challenge>): Challenge => ({
  id: 'c1',
  from_id: 'a',
  to_id: 'b',
  message: null,
  status: 'open',
  created_at: '2026-11-10T10:00:00.000Z',
  responded_at: null,
  ...over,
})

describe('challenges', () => {
  const now = new Date('2026-11-12T10:00:00.000Z')

  it('waits for an answer, then lapses after a week', () => {
    expect(challengeState(challenge({}), [], now).kind).toBe('waiting')
    expect(challengeState(challenge({ created_at: '2026-11-01T10:00:00.000Z' }), [], now).kind).toBe('expired')
  })

  it('is game on once accepted, until the next result between the two settles it', () => {
    const accepted = challenge({ status: 'accepted', responded_at: '2026-11-10T12:00:00.000Z' })
    const before = mk('2026-11-10T09:00:00.000Z', 'a', 'b', 1, 0)
    const other = mk('2026-11-11T09:00:00.000Z', 'a', 'c', 1, 0)
    expect(challengeState(accepted, [before, other], now).kind).toBe('game-on')
    const settled = mk('2026-11-11T20:00:00.000Z', 'b', 'a', 2, 2)
    const disputed = mk('2026-11-11T19:00:00.000Z', 'a', 'b', 9, 0, { status: 'disputed' })
    expect(challengeState(accepted, [before, other, disputed, settled], now)).toEqual({ kind: 'played', match: settled })
  })

  it('keeps live ones and recently settled ones, drops lapsed and called-off ones', () => {
    const list = [
      challenge({ id: 'live' }),
      challenge({ id: 'old', created_at: '2026-10-01T00:00:00.000Z' }),
      challenge({ id: 'off', status: 'cancelled', responded_at: '2026-11-11T00:00:00.000Z' }),
      challenge({ id: 'no', status: 'declined', responded_at: '2026-11-11T00:00:00.000Z' }),
    ]
    expect(liveChallenges(list, [], now).map((x) => x.challenge.id)).toEqual(['live', 'no'])
  })
})

describe('predictions', () => {
  it('are open from Monday until the end of Tuesday', () => {
    expect(predictionWindow(new Date('2026-11-10T23:59:00.000Z'), 'UTC')).toMatchObject({ week: '2026-11-09', open: true })
    expect(predictionWindow(new Date('2026-11-11T00:00:00.000Z'), 'UTC').open).toBe(false)
    // India is 5:30 ahead: Tuesday 23:00 there is still open.
    expect(predictionWindow(new Date('2026-11-10T17:30:00.000Z'), 'Asia/Kolkata').open).toBe(true)
    expect(predictionWindow(new Date('2026-11-10T18:31:00.000Z'), 'Asia/Kolkata').open).toBe(false)
  })

  it('scores right guesses from finished weeks', () => {
    const games = (week: string, winner: string) => [
      mk(`${week}T10:00:00.000Z`, winner, 'x', 2, 0),
      mk(`${week}T11:00:00.000Z`, winner, 'y', 2, 0),
      mk(`${week}T12:00:00.000Z`, winner, 'x', 2, 0),
    ]
    const w1 = weekResult(games('2026-10-05', 'a'), S, '2026-10-05')
    const w2 = weekResult(games('2026-10-12', 'b'), S, '2026-10-12')
    const p = (player_id: string, week_key: string, pick_id: string): Prediction => ({ player_id, week_key, pick_id, updated_at: '' })
    const picks = [p('a', '2026-10-05', 'a'), p('b', '2026-10-05', 'a'), p('a', '2026-10-12', 'a'), p('b', '2026-10-12', 'b'), p('c', '2026-10-19', 'c')]
    expect(oracleTable(picks, [w1, w2])).toEqual([
      { playerId: 'b', right: 2, made: 2, streak: 2 },
      { playerId: 'a', right: 1, made: 2, streak: 0 },
    ])
    expect(rightGuesses(picks, w2)).toEqual(['b'])
  })
})
