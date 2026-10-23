import type { Match, Player } from './types'

/** The stats eFootball shows on its full-time screen, in the order it shows them. */
export const STAT_LABELS = {
  possession: 'Possession',
  shots: 'Shots',
  shots_on_target: 'Shots on Target',
  fouls: 'Fouls',
  offsides: 'Offsides',
  corners: 'Corner Kicks',
  free_kicks: 'Free Kicks',
  passes: 'Passes',
  successful_passes: 'Successful Passes',
  crosses: 'Crosses',
  interceptions: 'Interceptions',
  tackles: 'Tackles',
  saves: 'Saves',
} as const

export type StatKey = keyof typeof STAT_LABELS
/** Home and away values for each stat that could be read. */
export type MatchStats = Partial<Record<StatKey, [number, number]>>

/** Edit distance turned into a 0-1 score. */
export function similarity(a: string, b: string) {
  if (a === b) return 1
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length, 1)
}

/** How alike two names are, from 0 to 1, ignoring case, spaces and symbols. */
export function nameSimilarity(a: string, b: string) {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return 1
  const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s = simple(a)
  const t = simple(b)
  return s.length < 2 || t.length < 2 ? 0 : similarity(s, t)
}

/**
 * Which active player an in-game name belongs to: first from earlier results that were read
 * from screenshots (newest first), then from the players' own names. OCR can get a letter
 * wrong, so names only need to be close.
 */
export function gameNameOwner(name: string, matches: Match[], players: Player[]): string | null {
  const active = new Set(players.filter((p) => p.active).map((p) => p.id))
  let best: string | null = null
  let bestScore = 0.8
  const newest = [...matches].sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at))
  for (const m of newest) {
    const names = m.details?.names
    if (!names) continue
    for (const [known, id] of [
      [names[0], m.home_id],
      [names[1], m.away_id],
    ] as const) {
      if (!known || !active.has(id)) continue
      const score = nameSimilarity(name, known)
      if (score > bestScore) {
        best = id
        bestScore = score
      }
    }
  }
  if (best) return best
  bestScore = 0.85
  for (const p of players) {
    if (!active.has(p.id)) continue
    const score = nameSimilarity(name, p.name)
    if (score > bestScore) {
      best = p.id
      bestScore = score
    }
  }
  return best
}
