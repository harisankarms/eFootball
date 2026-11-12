// The form rating: one number per player, like chess ratings. Everyone starts at 1000. After
// each result the winner takes points from the loser: more for beating someone rated higher,
// fewer for beating someone rated lower, and a little more for a big win. A draw moves points
// towards whoever was rated lower. Worked out from the list of matches like everything else.
import { chronological, isCounted, outcomeFor, sideOf, type Outcome } from './stats'
import type { Match } from './types'

export const START_RATING = 1000
/** How far one result can move a rating (before the bigger-win bonus). */
const K = 32

/** One player's rating after one of their matches. */
export type RatingPoint = {
  match: Match
  rating: number
  change: number
  opponentId: string
  outcome: Outcome
}

export type Ratings = {
  /** Every player's rating now, and their place (1 = highest). */
  current: Map<string, number>
  rank: Map<string, number>
  /** Each player's rating after every match they played, oldest first. */
  history: Map<string, RatingPoint[]>
  /** Highest rating each player has reached (never below the start). */
  peak: Map<string, { rating: number; match: Match | null }>
}

/** The chance the first player wins, from 0 to 1 (draws count as half). */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400))
}

/** Bigger wins move ratings a bit more: 1 goal ×1, 2 goals ×1.5, 3 goals ×1.75, then slowly more. */
export function marginWeight(goalDifference: number): number {
  const g = Math.abs(goalDifference)
  if (g <= 1) return 1
  if (g === 2) return 1.5
  return (11 + g) / 8
}

const SCORE: Record<Outcome, number> = { W: 1, D: 0.5, L: 0 }

export function ratings(matches: Match[]): Ratings {
  const current = new Map<string, number>()
  const history = new Map<string, RatingPoint[]>()
  const peak = new Map<string, { rating: number; match: Match | null }>()
  const get = (id: string) => current.get(id) ?? START_RATING

  for (const m of chronological(matches.filter(isCounted))) {
    if (m.home_id === m.away_id) continue
    const home = get(m.home_id)
    const away = get(m.away_id)
    const outcome = outcomeFor(m, m.home_id)
    const { gf, ga } = sideOf(m, m.home_id)
    const change = K * marginWeight(gf - ga) * (SCORE[outcome] - expectedScore(home, away))
    for (const [id, before, delta, opponentId] of [
      [m.home_id, home, change, m.away_id],
      [m.away_id, away, -change, m.home_id],
    ] as const) {
      const rating = before + delta
      current.set(id, rating)
      const list = history.get(id) ?? []
      list.push({ match: m, rating, change: delta, opponentId, outcome: outcomeFor(m, id) })
      history.set(id, list)
      const best = peak.get(id)
      if (!best || rating > best.rating) peak.set(id, { rating, match: m })
    }
  }
  for (const id of current.keys()) if ((peak.get(id)?.rating ?? 0) < START_RATING) peak.set(id, { rating: START_RATING, match: null })

  const order = [...current.entries()].sort((a, b) => b[1] - a[1])
  const rank = new Map<string, number>()
  order.forEach(([id], i) => {
    // Players on the same (rounded) rating share a place.
    const prev = order[i - 1]
    rank.set(id, prev && Math.round(prev[1]) === Math.round(order[i][1]) ? rank.get(prev[0])! : i + 1)
  })
  return { current, rank, history, peak }
}

/** How much a player's rating moved over the matches played since `since` (an instant). */
export function changeSince(points: RatingPoint[], since: number): number {
  let total = 0
  for (const p of points) if (Date.parse(p.match.played_at) >= since) total += p.change
  return total
}

/** "1,084" */
export const formatRating = (n: number) => Math.round(n).toLocaleString('en-US')

/** "+12", "−8" or "±0" */
export function formatChange(n: number): string {
  const r = Math.round(n)
  return r > 0 ? `+${r}` : r < 0 ? `−${-r}` : '±0'
}
