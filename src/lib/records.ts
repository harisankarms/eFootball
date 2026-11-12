// The group's all-time records (biggest win, longest win streak, most points in a week...) and
// every time one was broken. Worked out from the list of matches like everything else, so a
// fixed or deleted result corrects the records too.
import { ratings } from './rating'
import { cardRating, chronological, isCounted, outcomeFor, pastWeeks, sideOf } from './stats'
import { addDays, startOfDay } from './time'
import type { Match, Settings } from './types'

export type RecordKey =
  | 'biggest-win'
  | 'most-goals-game'
  | 'highest-scoring'
  | 'win-streak'
  | 'unbeaten'
  | 'clean-sheet-run'
  | 'scoring-run'
  | 'losing-run'
  | 'week-points'
  | 'week-goals'
  | 'best-card'
  | 'potw-crowns'
  | 'potw-row'
  | 'chendas'
  | 'peak-rating'

export type RecordGroup = 'game' | 'streak' | 'week' | 'career'

export type RecordInfo = {
  key: RecordKey
  group: RecordGroup
  title: string
  /** "7 wins", "6–0" style wording for a value. */
  unit: (value: number) => string
  /** A record nobody wants. */
  shame?: boolean
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const RECORDS: RecordInfo[] = [
  { key: 'biggest-win', group: 'game', title: 'Biggest win', unit: (n) => `${plural(n, 'goal')} margin` },
  { key: 'most-goals-game', group: 'game', title: 'Most goals in a game', unit: (n) => plural(n, 'goal') },
  { key: 'highest-scoring', group: 'game', title: 'Highest-scoring game', unit: (n) => `${plural(n, 'goal')} in total` },
  { key: 'win-streak', group: 'streak', title: 'Longest winning streak', unit: (n) => `${plural(n, 'win')} in a row` },
  { key: 'unbeaten', group: 'streak', title: 'Longest unbeaten run', unit: (n) => `${plural(n, 'game')} without losing` },
  { key: 'clean-sheet-run', group: 'streak', title: 'Clean sheets in a row', unit: (n) => `${plural(n, 'game')} without conceding` },
  { key: 'scoring-run', group: 'streak', title: 'Scoring in every game', unit: (n) => `${plural(n, 'game')} in a row` },
  { key: 'losing-run', group: 'streak', title: 'Longest losing run', unit: (n) => `${plural(n, 'defeat')} in a row`, shame: true },
  { key: 'week-points', group: 'week', title: 'Most points in a week', unit: (n) => `${Math.round(n * 100) / 100} points` },
  { key: 'week-goals', group: 'week', title: 'Most goals in a week', unit: (n) => plural(n, 'goal') },
  { key: 'best-card', group: 'week', title: 'Best Player of the Week card', unit: (n) => `${n} rated` },
  { key: 'potw-crowns', group: 'career', title: 'Most Player of the Week crowns', unit: (n) => plural(n, 'crown') },
  { key: 'potw-row', group: 'career', title: 'Player of the Week in a row', unit: (n) => `${plural(n, 'week')} running` },
  { key: 'chendas', group: 'career', title: 'Most chenda cards', unit: (n) => plural(n, 'chenda'), shame: true },
  { key: 'peak-rating', group: 'career', title: 'Highest form rating', unit: (n) => `${Math.round(n).toLocaleString('en-US')} rating` },
]

export const recordInfo = new Map(RECORDS.map((r) => [r.key, r]))

/** Who holds a record, with what, and when it was set. */
export type RecordMark = {
  holder: string
  value: number
  /** When it was set: the match, or the end of the week for weekly records. */
  at: string
  match: Match | null
  weekKey: string | null
}

export type RecordBreak = { key: RecordKey; mark: RecordMark; previous: RecordMark | null }

export type RecordBook = {
  current: Map<RecordKey, RecordMark>
  /** Every time a record changed hands or grew, in the order they were first broken. A run that keeps going is one entry. */
  breaks: RecordBreak[]
  /** Streak records whose holder is still on that run. */
  live: Set<RecordKey>
}

/** Records that grow one step at a time during a run: each run is one entry, not one per step. */
const RUNS = new Set<RecordKey>(['win-streak', 'unbeaten', 'clean-sheet-run', 'scoring-run', 'losing-run', 'potw-row', 'peak-rating'])

type Candidate = RecordMark & { key: RecordKey; time: number; seq: number }

export function recordBook(matches: Match[], settings: Settings, currentWeekKey: string): RecordBook {
  const tz = settings.timezone
  const candidates: Candidate[] = []
  let seq = 0
  const add = (key: RecordKey, holder: string, value: number, at: string, match: Match | null, weekKey: string | null) =>
    candidates.push({ key, holder, value, at, match, weekKey, time: Date.parse(at), seq: seq++ })

  // Single games and runs, match by match.
  type Runs = Record<'win' | 'unbeaten' | 'clean' | 'scoring' | 'losing', number>
  const runs = new Map<string, Runs>()
  for (const m of chronological(matches.filter(isCounted))) {
    const margin = Math.abs(m.home_goals - m.away_goals)
    const winner = m.home_goals > m.away_goals ? m.home_id : m.away_id
    if (margin > 0) add('biggest-win', winner, margin, m.played_at, m, null)
    add('highest-scoring', winner, m.home_goals + m.away_goals, m.played_at, m, null)
    for (const id of [m.home_id, m.away_id]) {
      const { gf, ga } = sideOf(m, id)
      if (gf > 0) add('most-goals-game', id, gf, m.played_at, m, null)
      const o = outcomeFor(m, id)
      const r = runs.get(id) ?? { win: 0, unbeaten: 0, clean: 0, scoring: 0, losing: 0 }
      r.win = o === 'W' ? r.win + 1 : 0
      r.unbeaten = o === 'L' ? 0 : r.unbeaten + 1
      r.clean = ga === 0 ? r.clean + 1 : 0
      r.scoring = gf > 0 ? r.scoring + 1 : 0
      r.losing = o === 'L' ? r.losing + 1 : 0
      runs.set(id, r)
      // A run starts counting as a record from two games.
      if (r.win >= 2) add('win-streak', id, r.win, m.played_at, m, null)
      if (r.unbeaten >= 2) add('unbeaten', id, r.unbeaten, m.played_at, m, null)
      if (r.clean >= 2) add('clean-sheet-run', id, r.clean, m.played_at, m, null)
      if (r.scoring >= 2) add('scoring-run', id, r.scoring, m.played_at, m, null)
      if (r.losing >= 2) add('losing-run', id, r.losing, m.played_at, m, null)
    }
  }
  // A highest-scoring game belongs to both players; it's credited to the winner (or home side in a draw).
  for (const c of candidates) if (c.key === 'highest-scoring' && c.match && c.match.home_goals === c.match.away_goals) c.holder = c.match.home_id

  // Finished weeks, set when the week ends.
  const weeks = pastWeeks(matches, settings, currentWeekKey).reverse()
  const crowns = new Map<string, number>()
  const chendas = new Map<string, number>()
  let row: { id: string; count: number; week: string } | null = null
  for (const w of weeks) {
    const at = startOfDay(addDays(w.weekKey, 7), tz).toISOString()
    const top = w.rows.filter((r) => r.played > 0)
    if (w.winner) {
      const id = w.winner.playerId
      add('week-points', id, w.winner.points, at, null, w.weekKey)
      add('best-card', id, cardRating(w.winner), at, null, w.weekKey)
      crowns.set(id, (crowns.get(id) ?? 0) + 1)
      add('potw-crowns', id, crowns.get(id)!, at, null, w.weekKey)
      row = row && row.id === id && addDays(row.week, 7) === w.weekKey ? { id, count: row.count + 1, week: w.weekKey } : { id, count: 1, week: w.weekKey }
      if (row.count >= 2) add('potw-row', id, row.count, at, null, w.weekKey)
    } else row = null
    const scorer = top.reduce<(typeof top)[number] | null>((best, r) => (!best || r.gf > best.gf ? r : best), null)
    if (scorer && scorer.gf > 0) add('week-goals', scorer.playerId, scorer.gf, at, null, w.weekKey)
    if (w.awards.chenda) {
      const id = w.awards.chenda.playerId
      chendas.set(id, (chendas.get(id) ?? 0) + 1)
      add('chendas', id, chendas.get(id)!, at, null, w.weekKey)
    }
  }

  // The form rating, after every match.
  for (const [id, history] of ratings(matches).history) for (const p of history) add('peak-rating', id, p.rating, p.match.played_at, p.match, null)

  candidates.sort((a, b) => a.time - b.time || a.seq - b.seq)
  const current = new Map<RecordKey, RecordMark>()
  const breaks: RecordBreak[] = []
  const lastBreak = new Map<RecordKey, RecordBreak>()
  for (const { key, time: _time, seq: _seq, ...mark } of candidates) {
    const held = current.get(key)
    if (held && mark.value <= held.value) continue
    current.set(key, mark)
    const last = lastBreak.get(key)
    if (held && last && RUNS.has(key) && held.holder === mark.holder) {
      last.mark = mark
      continue
    }
    const entry: RecordBreak = { key, mark, previous: held ?? null }
    breaks.push(entry)
    lastBreak.set(key, entry)
  }

  // Runs still going: the holder's run right now is the record.
  const live = new Set<RecordKey>()
  const runKey: [RecordKey, keyof Runs][] = [
    ['win-streak', 'win'],
    ['unbeaten', 'unbeaten'],
    ['clean-sheet-run', 'clean'],
    ['scoring-run', 'scoring'],
    ['losing-run', 'losing'],
  ]
  for (const [key, field] of runKey) {
    const mark = current.get(key)
    if (mark && runs.get(mark.holder)?.[field] === mark.value) live.add(key)
  }
  const lastWeek = weeks[weeks.length - 1]
  const potwRow = current.get('potw-row')
  if (potwRow && row && row.id === potwRow.holder && row.count === potwRow.value && lastWeek && row.week === lastWeek.weekKey && addDays(row.week, 7) === currentWeekKey)
    live.add('potw-row')

  return { current, breaks, live }
}

/**
 * Breaks worth a news item, oldest first: a record taken from an earlier mark (not the first one
 * set) that had stood for at least a day, so the flurry of records in the first games stays out.
 */
export function newsworthy(book: RecordBook, minStoodMs = 24 * 3600_000): RecordBreak[] {
  return book.breaks
    .filter((b) => b.previous && Date.parse(b.mark.at) - Date.parse(b.previous.at) >= minStoodMs)
    .sort((a, b) => Date.parse(a.mark.at) - Date.parse(b.mark.at))
}
