// Guessing the Player of the Week: open from Monday until the end of Tuesday (in the group's
// timezone), everyone's picks are shown once it closes, and a right guess scores a point.
import type { WeekResult } from './stats'
import { addDays, startOfDay, weekKey } from './time'
import type { Prediction } from './types'

export function predictionWindow(now: Date, tz: string) {
  const week = weekKey(now, tz)
  const closesAt = startOfDay(addDays(week, 2), tz)
  return { week, closesAt, open: now.getTime() < closesAt.getTime() }
}

export type OracleRow = { playerId: string; right: number; made: number; streak: number }

/**
 * Everyone's record at guessing, from finished weeks: right guesses, guesses made, and how many
 * right in a row up to their latest guess. Best first.
 */
export function oracleTable(predictions: Prediction[], weeks: WeekResult[]): OracleRow[] {
  const winners = new Map(weeks.map((w) => [w.weekKey, w.winner?.playerId ?? null]))
  const rows = new Map<string, OracleRow & { last: string }>()
  const sorted = [...predictions].filter((p) => winners.has(p.week_key)).sort((a, b) => a.week_key.localeCompare(b.week_key))
  for (const p of sorted) {
    const r = rows.get(p.player_id) ?? { playerId: p.player_id, right: 0, made: 0, streak: 0, last: '' }
    const hit = winners.get(p.week_key) === p.pick_id
    r.made++
    if (hit) r.right++
    r.streak = hit ? r.streak + 1 : 0
    r.last = p.week_key
    rows.set(p.player_id, r)
  }
  return [...rows.values()]
    .map(({ last: _last, ...r }) => r)
    .sort((a, b) => b.right - a.right || b.right / b.made - a.right / a.made || b.streak - a.streak)
}

/** Who guessed a finished week right. */
export function rightGuesses(predictions: Prediction[], week: WeekResult): string[] {
  const winner = week.winner?.playerId
  if (!winner) return []
  return predictions.filter((p) => p.week_key === week.weekKey && p.pick_id === winner).map((p) => p.player_id)
}
