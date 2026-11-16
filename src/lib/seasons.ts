// Seasons: each quarter of the year (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), numbered from the
// group's first. The champion has the most points over the season (with enough games), and each
// season has its own top scorer, best defence and chenda. Worked out from the matches.
import { buildTable, isCounted, weeklyAwards, type Awards, type MonthResult, type Row, type WeekResult } from './stats'
import { addMonths, monthKey, startOfDay } from './time'
import type { Match, Settings } from './types'

/** e.g. '2026-Q4' */
export type SeasonKey = string

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function seasonOfMonth(month: string): SeasonKey {
  const [y, m] = month.split('-').map(Number)
  return `${y}-Q${Math.ceil(m / 3)}`
}

export function seasonKeyOf(date: Date | string, tz: string): SeasonKey {
  return seasonOfMonth(monthKey(date, tz))
}

/** The season's three months, e.g. ['2026-10', '2026-11', '2026-12']. */
export function seasonMonths(key: SeasonKey): string[] {
  const [y, q] = key.split('-Q').map(Number)
  const first = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}`
  return [first, addMonths(first, 1), addMonths(first, 2)]
}

export function addSeasons(key: SeasonKey, n: number): SeasonKey {
  return seasonOfMonth(addMonths(seasonMonths(key)[0], n * 3))
}

/** When the season starts and ends (the start of the next one), in the group's timezone. */
export function seasonBounds(key: SeasonKey, tz: string) {
  const [first] = seasonMonths(key)
  return { start: startOfDay(`${first}-01`, tz), end: startOfDay(`${addMonths(first, 3)}-01`, tz) }
}

/** "Oct–Dec 2026" */
export function seasonSpan(key: SeasonKey): string {
  const months = seasonMonths(key)
  const [y, m] = months[0].split('-').map(Number)
  return `${MONTHS[m - 1]}–${MONTHS[m + 1]} ${y}`
}

/** "Season 1": counted from the group's first season. */
export function seasonName(key: SeasonKey, first: SeasonKey): string {
  let n = 1
  for (let k = first; k < key && n < 400; k = addSeasons(k, 1)) n++
  return `Season ${n}`
}

/** The champion needs six weeks' worth of the weekly minimum: 18 games with the usual 3. */
export const seasonMinimum = (s: Settings) => s.potw_min_matches * 6

export type SeasonResult = {
  key: SeasonKey
  matches: Match[]
  rows: Row[]
  /** Most points among players with enough games. */
  champion: Row | null
  /** Top scorer, best defence (most clean sheets), biggest win and the season's chenda. */
  awards: Awards
  /** Player of the Week crowns won in the season (by the Monday each week starts). */
  crowns: Map<string, number>
  /** Player of the Month titles won in the season. */
  months: Map<string, number>
}

export function seasonResult(
  matches: Match[],
  s: Settings,
  key: SeasonKey,
  weeks: WeekResult[] = [],
  monthResults: MonthResult[] = [],
  nameOf?: (id: string) => string,
): SeasonResult {
  const counted = matches.filter((m) => isCounted(m) && seasonKeyOf(m.played_at, s.timezone) === key)
  const rows = buildTable(counted, s, seasonMinimum(s), nameOf)
  const tally = (ids: (string | undefined)[]) => {
    const out = new Map<string, number>()
    for (const id of ids) if (id) out.set(id, (out.get(id) ?? 0) + 1)
    return out
  }
  return {
    key,
    matches: counted,
    rows,
    champion: rows.find((r) => r.qualified && r.played > 0) ?? null,
    awards: weeklyAwards(rows, counted),
    crowns: tally(weeks.filter((w) => seasonOfMonth(w.weekKey.slice(0, 7)) === key).map((w) => w.winner?.playerId)),
    months: tally(monthResults.filter((m) => seasonOfMonth(m.monthKey) === key).map((m) => m.winner?.playerId)),
  }
}

/** The first season anyone played, or null with no results yet. */
export function firstSeason(matches: Match[], tz: string): SeasonKey | null {
  let first: SeasonKey | null = null
  for (const m of matches) {
    if (!isCounted(m)) continue
    const k = seasonKeyOf(m.played_at, tz)
    if (!first || k < first) first = k
  }
  return first
}

/** Finished seasons that had results, newest first. */
export function pastSeasons(
  matches: Match[],
  s: Settings,
  current: SeasonKey,
  weeks: WeekResult[] = [],
  monthResults: MonthResult[] = [],
  nameOf?: (id: string) => string,
): SeasonResult[] {
  const keys = new Set<SeasonKey>()
  for (const m of matches) if (isCounted(m)) keys.add(seasonKeyOf(m.played_at, s.timezone))
  return [...keys]
    .filter((k) => k < current)
    .sort()
    .reverse()
    .map((k) => seasonResult(matches, s, k, weeks, monthResults, nameOf))
}
