// Every number on the site is derived from the list of matches here, so
// editing or deleting a match automatically corrects every table and award.
// Disputed matches are left out until an admin resolves them.
import type { Match, Settings } from './types'
import { weekKey as toWeekKey } from './time'

export type Outcome = 'W' | 'D' | 'L'

export const isCounted = (m: Match) => m.status === 'ok'

export const involves = (m: Match, id: string) => m.home_id === id || m.away_id === id

export function sideOf(m: Match, id: string) {
  const home = m.home_id === id
  return {
    gf: home ? m.home_goals : m.away_goals,
    ga: home ? m.away_goals : m.home_goals,
    opponentId: home ? m.away_id : m.home_id,
  }
}

/** A penalty shootout decides the result, but shootout goals don't count as goals. */
export function outcomeFor(m: Match, id: string): Outcome {
  const { gf, ga } = sideOf(m, id)
  if (gf !== ga) return gf > ga ? 'W' : 'L'
  if (m.pens_winner_id) return m.pens_winner_id === id ? 'W' : 'L'
  return 'D'
}

export function winnerOf(m: Match): string | null {
  if (m.home_goals > m.away_goals) return m.home_id
  if (m.away_goals > m.home_goals) return m.away_id
  return m.pens_winner_id
}

const time = (iso: string) => Date.parse(iso)

/** Oldest first. */
export function chronological(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => time(a.played_at) - time(b.played_at) || time(a.created_at) - time(b.created_at))
}

/** Newest first. */
export function newestFirst(matches: Match[]): Match[] {
  return chronological(matches).reverse()
}

export type Row = {
  playerId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  cleanSheets: number
  points: number
  winPct: number
  /** Last five results, oldest first. */
  form: Outcome[]
  qualified: boolean
  gamesNeeded: number
}

export function pointsFor(r: { won: number; drawn: number; gf: number; cleanSheets: number }, s: Settings): number {
  const raw = r.won * s.potw_win + r.drawn * s.potw_draw + r.gf * s.potw_goal + r.cleanSheets * s.potw_clean_sheet
  return Math.round(raw * 100) / 100
}

/** Positive when `a` has beaten `b` more often than the other way round in these matches. */
export function headToHeadEdge(matches: Match[], a: string, b: string): number {
  let edge = 0
  for (const m of matches) {
    if (!isCounted(m) || !involves(m, a) || !involves(m, b)) continue
    const o = outcomeFor(m, a)
    if (o === 'W') edge++
    else if (o === 'L') edge--
  }
  return edge
}

/** Points, then win %, goal difference, goals scored, head-to-head, then name. */
export function rankRows(rows: Row[], matches: Match[], nameOf?: (id: string) => string): Row[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.winPct - a.winPct ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      headToHeadEdge(matches, b.playerId, a.playerId) ||
      (nameOf ? nameOf(a.playerId).localeCompare(nameOf(b.playerId)) : 0),
  )
}

export function buildTable(
  matches: Match[],
  s: Settings,
  minMatches = 0,
  nameOf?: (id: string) => string,
): Row[] {
  const counted = chronological(matches.filter(isCounted))
  const acc = new Map<string, Row & { history: Outcome[] }>()
  for (const m of counted) {
    for (const id of [m.home_id, m.away_id]) {
      let r = acc.get(id)
      if (!r) {
        r = {
          playerId: id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          cleanSheets: 0,
          points: 0,
          winPct: 0,
          form: [],
          qualified: false,
          gamesNeeded: 0,
          history: [],
        }
        acc.set(id, r)
      }
      const { gf, ga } = sideOf(m, id)
      const o = outcomeFor(m, id)
      r.played++
      if (o === 'W') r.won++
      else if (o === 'L') r.lost++
      else r.drawn++
      r.gf += gf
      r.ga += ga
      if (ga === 0) r.cleanSheets++
      r.history.push(o)
    }
  }
  const rows: Row[] = [...acc.values()].map(({ history, ...r }) => ({
    ...r,
    gd: r.gf - r.ga,
    points: pointsFor(r, s),
    winPct: r.played ? (r.won / r.played) * 100 : 0,
    form: history.slice(-5),
    qualified: r.played >= minMatches,
    gamesNeeded: Math.max(0, minMatches - r.played),
  }))
  return rankRows(rows, counted, nameOf)
}

export function groupByWeek(matches: Match[], tz: string): Map<string, Match[]> {
  const out = new Map<string, Match[]>()
  for (const m of matches) {
    if (!isCounted(m)) continue
    const k = toWeekKey(m.played_at, tz)
    const list = out.get(k)
    if (list) list.push(m)
    else out.set(k, [m])
  }
  return out
}

export type Awards = {
  goldenBoot: { ids: string[]; goals: number } | null
  wall: { ids: string[]; cleanSheets: number } | null
  biggestWin: Match | null
  woodenSpoon: Row | null
}

export function biggestWinIn(matches: Match[]): Match | null {
  let best: Match | null = null
  for (const m of matches) {
    if (!isCounted(m)) continue
    const margin = Math.abs(m.home_goals - m.away_goals)
    if (margin === 0) continue
    if (!best) {
      best = m
      continue
    }
    const bestMargin = Math.abs(best.home_goals - best.away_goals)
    const total = m.home_goals + m.away_goals
    const bestTotal = best.home_goals + best.away_goals
    if (margin > bestMargin || (margin === bestMargin && total > bestTotal)) best = m
  }
  return best
}

/** `rows` must be ranked (as returned by buildTable). */
export function weeklyAwards(rows: Row[], matches: Match[]): Awards {
  const played = rows.filter((r) => r.played > 0)
  const maxGoals = Math.max(0, ...played.map((r) => r.gf))
  const maxCs = Math.max(0, ...played.map((r) => r.cleanSheets))
  const qualified = rows.filter((r) => r.qualified && r.played > 0)
  return {
    goldenBoot: maxGoals > 0 ? { ids: played.filter((r) => r.gf === maxGoals).map((r) => r.playerId), goals: maxGoals } : null,
    wall: maxCs > 0 ? { ids: played.filter((r) => r.cleanSheets === maxCs).map((r) => r.playerId), cleanSheets: maxCs } : null,
    biggestWin: biggestWinIn(matches),
    // Only handed out when at least three people qualified, so a two-player week has no spoon.
    woodenSpoon: qualified.length >= 3 ? qualified[qualified.length - 1] : null,
  }
}

export type WeekResult = {
  weekKey: string
  matches: Match[]
  rows: Row[]
  /** Best-ranked player who played enough games, or null. */
  winner: Row | null
  awards: Awards
}

export function weekResult(
  weekMatches: Match[],
  s: Settings,
  weekKey: string,
  nameOf?: (id: string) => string,
): WeekResult {
  const counted = weekMatches.filter(isCounted)
  const rows = buildTable(counted, s, s.potw_min_matches, nameOf)
  return {
    weekKey,
    matches: counted,
    rows,
    winner: rows.find((r) => r.qualified && r.played > 0) ?? null,
    awards: weeklyAwards(rows, counted),
  }
}

/** Completed weeks that had at least one match, newest first. */
export function pastWeeks(
  matches: Match[],
  s: Settings,
  currentWeekKey: string,
  nameOf?: (id: string) => string,
): WeekResult[] {
  const byWeek = groupByWeek(matches, s.timezone)
  return [...byWeek.keys()]
    .filter((k) => k < currentWeekKey)
    .sort()
    .reverse()
    .map((k) => weekResult(byWeek.get(k)!, s, k, nameOf))
}

export type Trophies = { potw: number; goldenBoots: number; walls: number; spoons: number }

export function trophyCounts(weeks: WeekResult[]): Map<string, Trophies> {
  const out = new Map<string, Trophies>()
  const get = (id: string) => {
    let t = out.get(id)
    if (!t) {
      t = { potw: 0, goldenBoots: 0, walls: 0, spoons: 0 }
      out.set(id, t)
    }
    return t
  }
  for (const w of weeks) {
    if (w.winner) get(w.winner.playerId).potw++
    for (const id of w.awards.goldenBoot?.ids ?? []) get(id).goldenBoots++
    for (const id of w.awards.wall?.ids ?? []) get(id).walls++
    if (w.awards.woodenSpoon) get(w.awards.woodenSpoon.playerId).spoons++
  }
  return out
}

export type OpponentRecord = {
  opponentId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
}

export type PlayerSummary = {
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  cleanSheets: number
  winPct: number
  goalsPerGame: number
  /** Last ten results, oldest first. */
  form: Outcome[]
  currentStreak: { outcome: Outcome; count: number } | null
  bestWinStreak: number
  bestUnbeatenRun: number
  biggestWin: Match | null
  heaviestDefeat: Match | null
  opponents: OpponentRecord[]
}

export function playerSummary(matches: Match[], id: string): PlayerSummary {
  const mine = chronological(matches.filter((m) => isCounted(m) && involves(m, id)))
  const s: PlayerSummary = {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    cleanSheets: 0,
    winPct: 0,
    goalsPerGame: 0,
    form: [],
    currentStreak: null,
    bestWinStreak: 0,
    bestUnbeatenRun: 0,
    biggestWin: null,
    heaviestDefeat: null,
    opponents: [],
  }
  const opp = new Map<string, OpponentRecord>()
  let winRun = 0
  let unbeatenRun = 0
  const outcomes: Outcome[] = []
  for (const m of mine) {
    const { gf, ga, opponentId } = sideOf(m, id)
    const o = outcomeFor(m, id)
    outcomes.push(o)
    s.played++
    s.gf += gf
    s.ga += ga
    if (ga === 0) s.cleanSheets++
    if (o === 'W') s.won++
    else if (o === 'L') s.lost++
    else s.drawn++

    winRun = o === 'W' ? winRun + 1 : 0
    unbeatenRun = o === 'L' ? 0 : unbeatenRun + 1
    s.bestWinStreak = Math.max(s.bestWinStreak, winRun)
    s.bestUnbeatenRun = Math.max(s.bestUnbeatenRun, unbeatenRun)

    const margin = gf - ga
    if (margin > 0) {
      const b = s.biggestWin && sideOf(s.biggestWin, id)
      if (!b || margin > b.gf - b.ga || (margin === b.gf - b.ga && gf > b.gf)) s.biggestWin = m
    } else if (margin < 0) {
      const w = s.heaviestDefeat && sideOf(s.heaviestDefeat, id)
      if (!w || margin < w.gf - w.ga || (margin === w.gf - w.ga && ga > w.ga)) s.heaviestDefeat = m
    }

    let r = opp.get(opponentId)
    if (!r) {
      r = { opponentId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 }
      opp.set(opponentId, r)
    }
    r.played++
    r.gf += gf
    r.ga += ga
    if (o === 'W') r.won++
    else if (o === 'L') r.lost++
    else r.drawn++
  }
  s.winPct = s.played ? (s.won / s.played) * 100 : 0
  s.goalsPerGame = s.played ? s.gf / s.played : 0
  s.form = outcomes.slice(-10)
  if (outcomes.length) {
    const last = outcomes[outcomes.length - 1]
    let count = 0
    for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === last; i--) count++
    s.currentStreak = { outcome: last, count }
  }
  s.opponents = [...opp.values()].sort((a, b) => b.played - a.played || b.won - a.won)
  return s
}

export type HeadToHead = {
  /** Newest first. */
  matches: Match[]
  played: number
  aWins: number
  bWins: number
  draws: number
  aGoals: number
  bGoals: number
  aCleanSheets: number
  bCleanSheets: number
  aPensWins: number
  bPensWins: number
  aBiggestWin: Match | null
  bBiggestWin: Match | null
  aLongestWinStreak: number
  bLongestWinStreak: number
  /** The run the most recent meetings are on: one side winning in a row, or draws. */
  streak: { side: 'a' | 'b' | 'draw'; count: number } | null
  /** Last five meetings, oldest first, from each player's point of view. */
  aForm: Outcome[]
  bForm: Outcome[]
  highestScoring: Match | null
  firstMeeting: Match | null
}

const flip: Record<Outcome, Outcome> = { W: 'L', D: 'D', L: 'W' }

export function headToHead(matches: Match[], a: string, b: string): HeadToHead {
  const mutual = chronological(matches.filter((m) => isCounted(m) && involves(m, a) && involves(m, b)))
  const h: HeadToHead = {
    matches: [...mutual].reverse(),
    played: mutual.length,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aGoals: 0,
    bGoals: 0,
    aCleanSheets: 0,
    bCleanSheets: 0,
    aPensWins: 0,
    bPensWins: 0,
    aBiggestWin: null,
    bBiggestWin: null,
    aLongestWinStreak: 0,
    bLongestWinStreak: 0,
    streak: null,
    aForm: [],
    bForm: [],
    highestScoring: null,
    firstMeeting: mutual[0] ?? null,
  }
  const aWinsList: Match[] = []
  const bWinsList: Match[] = []
  const outcomes: Outcome[] = []
  let aRun = 0
  let bRun = 0
  for (const m of mutual) {
    const { gf, ga } = sideOf(m, a)
    h.aGoals += gf
    h.bGoals += ga
    if (ga === 0) h.aCleanSheets++
    if (gf === 0) h.bCleanSheets++
    const o = outcomeFor(m, a)
    outcomes.push(o)
    aRun = o === 'W' ? aRun + 1 : 0
    bRun = o === 'L' ? bRun + 1 : 0
    h.aLongestWinStreak = Math.max(h.aLongestWinStreak, aRun)
    h.bLongestWinStreak = Math.max(h.bLongestWinStreak, bRun)
    if (o === 'W') {
      h.aWins++
      aWinsList.push(m)
      if (m.pens_winner_id) h.aPensWins++
    } else if (o === 'L') {
      h.bWins++
      bWinsList.push(m)
      if (m.pens_winner_id) h.bPensWins++
    } else h.draws++
    const total = m.home_goals + m.away_goals
    if (!h.highestScoring || total >= h.highestScoring.home_goals + h.highestScoring.away_goals) h.highestScoring = m
  }
  h.aBiggestWin = biggestWinIn(aWinsList)
  h.bBiggestWin = biggestWinIn(bWinsList)
  h.aForm = outcomes.slice(-5)
  h.bForm = h.aForm.map((o) => flip[o])
  if (outcomes.length) {
    const last = outcomes[outcomes.length - 1]
    let count = 0
    for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === last; i--) count++
    h.streak = { side: last === 'W' ? 'a' : last === 'L' ? 'b' : 'draw', count }
  }
  return h
}

export type Rivalry = {
  /** The player leading the rivalry (or either one when level). */
  a: string
  b: string
  played: number
  aWins: number
  bWins: number
  draws: number
  lastPlayed: string
}

/** Every pair of players who have met, most-played first. */
export function rivalries(matches: Match[]): Rivalry[] {
  const pairs = new Map<string, Rivalry>()
  for (const m of matches) {
    if (!isCounted(m)) continue
    const [a, b] = [m.home_id, m.away_id].sort()
    const key = `${a}|${b}`
    const r = pairs.get(key) ?? { a, b, played: 0, aWins: 0, bWins: 0, draws: 0, lastPlayed: m.played_at }
    r.played++
    const o = outcomeFor(m, a)
    if (o === 'W') r.aWins++
    else if (o === 'L') r.bWins++
    else r.draws++
    if (Date.parse(m.played_at) > Date.parse(r.lastPlayed)) r.lastPlayed = m.played_at
    pairs.set(key, r)
  }
  return [...pairs.values()]
    .map((r) => (r.bWins > r.aWins ? { ...r, a: r.b, b: r.a, aWins: r.bWins, bWins: r.aWins } : r))
    .sort((x, y) => y.played - x.played || Date.parse(y.lastPlayed) - Date.parse(x.lastPlayed))
}

/** An eFootball-style 60-99 card rating from a week's numbers, for the Player of the Week cards. */
export function cardRating(r: Row): number {
  if (!r.played) return 60
  const winRate = r.won / r.played
  const goalsPerGame = r.gf / r.played
  const cleanSheetRate = r.cleanSheets / r.played
  const raw = 64 + 20 * winRate + 3 * Math.min(goalsPerGame, 4) + 6 * cleanSheetRate + 0.6 * Math.min(r.played, 10)
  return Math.max(60, Math.min(99, Math.round(raw)))
}

export function formatPoints(n: number): string {
  return String(Math.round(n * 100) / 100)
}

export function formatPct(n: number): string {
  return `${Math.round(n)}%`
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}
