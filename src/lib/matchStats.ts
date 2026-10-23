import { involves, isCounted } from './stats'
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
/** One side's numbers from a match's stats table. */
export type SideStats = Partial<Record<StatKey, number>>

/** A player's numbers from a match's stats table and their opponent's, when the table was read. */
export function sidesOf(m: Match, playerId: string): { mine: SideStats; theirs: SideStats } | null {
  const stats = m.details?.stats
  if (!stats || !involves(m, playerId)) return null
  const home = m.home_id === playerId
  const mine: SideStats = {}
  const theirs: SideStats = {}
  for (const [key, pair] of Object.entries(stats) as [StatKey, [number, number] | undefined][]) {
    if (!pair) continue
    mine[key] = home ? pair[0] : pair[1]
    theirs[key] = home ? pair[1] : pair[0]
  }
  return { mine, theirs }
}

/** Averages over several matches (each stat over the matches it was read in) and the two accuracies in percent. */
export type StatSummary = {
  matches: number
  avg: SideStats
  shotAccuracy: number | null
  passAccuracy: number | null
}

export function summarise(sides: SideStats[]): StatSummary {
  const sum: SideStats = {}
  const count: SideStats = {}
  let shots = 0
  let onTarget = 0
  let passes = 0
  let completed = 0
  for (const s of sides) {
    for (const [key, v] of Object.entries(s) as [StatKey, number | undefined][]) {
      if (v == null) continue
      sum[key] = (sum[key] ?? 0) + v
      count[key] = (count[key] ?? 0) + 1
    }
    if (s.shots != null && s.shots_on_target != null) {
      shots += s.shots
      onTarget += s.shots_on_target
    }
    if (s.passes != null && s.successful_passes != null) {
      passes += s.passes
      completed += s.successful_passes
    }
  }
  const avg: SideStats = {}
  for (const key of Object.keys(sum) as StatKey[]) avg[key] = sum[key]! / count[key]!
  return {
    matches: sides.length,
    avg,
    shotAccuracy: shots ? (onTarget / shots) * 100 : null,
    passAccuracy: passes ? (completed / passes) * 100 : null,
  }
}

/** A player's averages over their counted matches that have stats. */
export function playerStats(matches: Match[], playerId: string, counts: (m: Match) => boolean = isCounted): StatSummary {
  return summarise(matches.filter(counts).flatMap((m) => sidesOf(m, playerId)?.mine ?? []))
}

/** Both players' averages over the counted meetings between them that have stats. */
export function meetingStats(matches: Match[], a: string, b: string): { a: StatSummary; b: StatSummary } {
  const sides = matches.filter((m) => isCounted(m) && involves(m, b)).flatMap((m) => sidesOf(m, a) ?? [])
  return { a: summarise(sides.map((s) => s.mine)), b: summarise(sides.map((s) => s.theirs)) }
}

/** Shows an average: percentages rounded, per-match numbers to one decimal. */
export function formatStat(value: number, percent: boolean) {
  return percent ? `${Math.round(value)}%` : value.toFixed(1)
}

export type StatLeader = { title: string; detail: string; percent: boolean; playerId: string; value: number; matches: number }

const LEADER_BOARDS: { title: string; detail: string; percent: boolean; pick: (s: StatSummary) => number | null | undefined }[] = [
  { title: 'Best passer', detail: 'passes completed', percent: true, pick: (s) => s.passAccuracy },
  { title: 'Most shots on target', detail: 'a match', percent: false, pick: (s) => s.avg.shots_on_target },
  { title: 'Most possession', detail: 'on average', percent: true, pick: (s) => s.avg.possession },
  { title: 'Most tackles', detail: 'a match', percent: false, pick: (s) => s.avg.tackles },
  { title: 'Most interceptions', detail: 'a match', percent: false, pick: (s) => s.avg.interceptions },
]

/**
 * Who leads each stat over a set of matches. So that one lucky game can't top a board, a
 * player needs at least a quarter as many matches with stats as the busiest player.
 * `counts` picks the results that count; a tournament counts all of its own.
 */
export function statLeaders(matches: Match[], counts: (m: Match) => boolean = isCounted): StatLeader[] {
  const ids = new Set(matches.flatMap((m) => (counts(m) && m.details?.stats ? [m.home_id, m.away_id] : [])))
  const players = [...ids].map((id) => ({ id, s: playerStats(matches, id, counts) })).filter((p) => p.s.matches > 0)
  if (!players.length) return []
  const needed = Math.max(1, Math.ceil(Math.max(...players.map((p) => p.s.matches)) / 4))
  const eligible = players.filter((p) => p.s.matches >= needed)
  const leaders: StatLeader[] = []
  for (const { pick, ...board } of LEADER_BOARDS) {
    let best: StatLeader | null = null
    for (const p of eligible) {
      const value = pick(p.s)
      if (value == null) continue
      if (!best || value > best.value || (value === best.value && p.s.matches > best.matches)) {
        best = { ...board, playerId: p.id, value, matches: p.s.matches }
      }
    }
    if (best) leaders.push(best)
  }
  return leaders
}

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
