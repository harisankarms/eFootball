import type { Match, MatchInput } from './types'

/** Two logs of the same game are usually minutes apart; a rematch with the same score is rarer. */
export const DUPLICATE_WINDOW_MS = 60 * 60_000

type Result = Pick<MatchInput, 'home_id' | 'away_id' | 'home_goals' | 'away_goals' | 'played_at'>

/** Whether two results are the same two players with the same score, from either side. */
function sameResult(m: Result, r: Result) {
  return (
    (m.home_id === r.home_id && m.away_id === r.away_id && m.home_goals === r.home_goals && m.away_goals === r.away_goals) ||
    (m.home_id === r.away_id && m.away_id === r.home_id && m.home_goals === r.away_goals && m.away_goals === r.home_goals)
  )
}

/**
 * A result already logged that looks like this one: the same players and score, played within
 * an hour. Happens when both players log the game, or a save is retried after a bad connection.
 * Returns the closest one in time, or null.
 */
export function findDuplicate(matches: readonly Match[], input: Result, windowMs = DUPLICATE_WINDOW_MS): Match | null {
  const at = Date.parse(input.played_at)
  let best: Match | null = null
  let bestGap = Infinity
  for (const m of matches) {
    if (!sameResult(m, input)) continue
    const gap = Math.abs(Date.parse(m.played_at) - at)
    if (gap <= windowMs && gap < bestGap) {
      best = m
      bestGap = gap
    }
  }
  return best
}
