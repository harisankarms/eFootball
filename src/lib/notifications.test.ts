import { describe, expect, it } from 'vitest'
import { answerMessage, challengeMessage, disputeMessage, monthMessage, recordMessages, resolvedMessage, resultMessages, weekMessage } from './notifications'
import type { League } from './queries'
import { monthResult, weekResult } from './stats'
import { DEFAULT_SETTINGS, type Challenge, type Match, type Player } from './types'

const S = { ...DEFAULT_SETTINGS, timezone: 'UTC' }
const player = (id: string, name: string, is_admin = false): Player => ({
  id,
  name,
  user_id: null,
  avatar_url: null,
  card_url: null,
  is_admin,
  active: true,
  created_at: '2026-10-01T00:00:00.000Z',
})
const players = [player('a', 'Abhi', true), player('b', 'Bala'), player('c', 'Chris'), player('d', 'Dev')]
const league: League = {
  players,
  matches: [],
  settings: S,
  tz: 'UTC',
  byId: new Map(players.map((p) => [p.id, p])),
  nameOf: (id) => players.find((p) => p.id === id)?.name ?? 'Unknown',
  colorOf: () => '#3987e5',
}

let seq = 0
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

describe('notifications', () => {
  it('tells the other player about a result, and everyone else only if they follow every result', () => {
    const m = mk(0, 'a', 'b', 3, 1)
    const [players, all] = resultMessages(league, m, 'a')
    expect(players).toMatchObject({ topic: 'results', to: ['b'], title: 'Abhi logged a result', url: `/match/${m.id}` })
    expect(players.body).toContain('Abhi 3–1 Bala')
    expect(players.body).toContain('24 hours')
    expect(all).toMatchObject({ topic: 'all-results', to: ['c', 'd'] })
  })

  it('tells both players when someone else logs their game', () => {
    const m = mk(0, 'a', 'b', 1, 1, { pens_winner_id: 'b', submitted_by: 'c' })
    const [players] = resultMessages(league, m, 'c')
    expect(players.to).toEqual(['a', 'b'])
    expect(players.body).toContain('(Bala on pens)')
  })

  it('announces a broken record once, and not every game a streak it already holds grows by', () => {
    const old = [mk(0, 'b', 'c', 2, 0), mk(0, 'b', 'c', 2, 0)]
    const big = mk(3, 'a', 'c', 6, 0)
    const msgs = recordMessages(league, [...old, big], big, new Date('2026-11-12T00:00:00Z'))
    const biggest = msgs.find((m) => m.key === `record:biggest-win:${big.id}`)
    expect(biggest).toMatchObject({ topic: 'records', to: 'all', title: 'Record broken: Biggest win' })
    expect(biggest!.body).toContain('Abhi set a new record')

    // a then keeps winning: a streak a already holds growing is not news again.
    const w1 = mk(5, 'a', 'b', 1, 0)
    const w2 = mk(6, 'a', 'b', 1, 0)
    const w3 = mk(7, 'a', 'b', 1, 0)
    const all = [...old, big, w1, w2, w3]
    const third = recordMessages(league, all, w3, new Date('2026-11-12T00:00:00Z'))
    expect(third.some((m) => m.key.startsWith('record:win-streak'))).toBe(false)
  })

  it('sends disputes to whoever logged it and the admins, never the one disputing', () => {
    const m = mk(0, 'b', 'c', 2, 0, { submitted_by: 'b' })
    const d = disputeMessage(league, m, 'c', '  It was 2-2  ', new Date('2026-11-01T10:20:00Z'))
    expect(d.to).toEqual(['b', 'a'])
    expect(d.body).toContain('“It was 2-2”')
    expect(d.key).toBe(`dispute:${m.id}:202611011020`)
    expect(resolvedMessage(league, m, 'a').to).toEqual(['b', 'c'])
  })

  it('crowns the week and the month for everyone', () => {
    const games = [mk(0, 'a', 'b', 2, 0), mk(1, 'a', 'c', 1, 0), mk(2, 'a', 'd', 3, 1), mk(2, 'b', 'c', 0, 1), mk(2, 'b', 'd', 0, 0), mk(3, 'c', 'd', 1, 1), mk(3, 'b', 'c', 0, 2), mk(3, 'd', 'b', 1, 0)]
    const week = weekResult(games, S, '2026-10-05', league.nameOf)
    const w = weekMessage(league, week)!
    expect(w).toMatchObject({ key: 'week:2026-10-05', topic: 'winners', to: 'all', url: '/?recap=2026-10-05' })
    expect(w.title).toBe('👑 Abhi is Player of the Week')
    expect(w.body).toContain('Bala got the chenda')
    expect(weekMessage(league, weekResult([], S, '2026-10-12'))).toBeNull()
    expect(monthMessage(league, monthResult([], S, '2026-10'))).toBeNull()
  })

  it('tells the challenged player, and the sender about the answer', () => {
    const c: Challenge = { id: 'x1', from_id: 'a', to_id: 'b', message: 'Rematch?', status: 'open', created_at: '', responded_at: null }
    expect(challengeMessage(league, c)).toMatchObject({ to: ['b'], title: 'Abhi challenged you', topic: 'challenges' })
    expect(answerMessage(league, c, 'accepted')).toMatchObject({ to: ['a'], title: 'Bala accepted your challenge', key: 'challenge:x1:accepted' })
  })
})
