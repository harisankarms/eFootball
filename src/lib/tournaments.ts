// Tournaments: a round-robin league stage, then optional knockouts. Like every other stat,
// fixtures, tables and the bracket are worked out from the results, so they always agree.
import { chronological, outcomeFor, sideOf, winnerOf, type Outcome } from './stats'
import type { Match, Stage, Tournament } from './types'

export type KnockoutStage = Exclude<Stage, 'league'>

export const STAGE_LABELS: Record<Stage, string> = {
  league: 'League stage',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
}

const ROUND_LABELS: Record<KnockoutStage, string> = { qf: 'Quarter-finals', sf: 'Semi-finals', final: 'Final' }
const SHORT: Record<KnockoutStage, string> = { qf: 'QF', sf: 'SF', final: 'Final' }

/** The knockout rounds for each size, and who meets whom in the first one (by league position). */
const BRACKETS: Record<2 | 4 | 8, { stages: KnockoutStage[]; first: [number, number][] }> = {
  2: { stages: ['final'], first: [[1, 2]] },
  4: { stages: ['sf', 'final'], first: [[1, 4], [2, 3]] },
  8: {
    stages: ['qf', 'sf', 'final'],
    first: [[1, 8], [4, 5], [2, 7], [3, 6]],
  },
}

export type Fixture = { round: number; home: string; away: string; match: Match | null }

export type StandingRow = {
  playerId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
  form: Outcome[]
}

export type Tie = {
  stage: KnockoutStage
  /** The two players, once known. */
  a: string | null
  b: string | null
  /** Where each side comes from, shown until it's known: "1st", "Winner SF1". */
  aFrom: string
  bFrom: string
  match: Match | null
  winner: string | null
}

export type KnockoutRound = { stage: KnockoutStage; label: string; ties: Tie[] }

export type OpenGame = { stage: Stage; home: string; away: string }

export type TournamentState = {
  /** Every result in the tournament that isn't disputed, newest first. */
  matches: Match[]
  fixtures: Fixture[]
  table: StandingRow[]
  leagueDone: boolean
  rounds: KnockoutRound[]
  champion: string | null
  /** The stage being played now. */
  phase: Stage | 'finished'
  /** Games that can be played now. */
  open: OpenGame[]
}

const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? `${n}th` : `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`)

const samePair = (m: Match, a: string, b: string) => (m.home_id === a && m.away_id === b) || (m.home_id === b && m.away_id === a)

/**
 * The league fixtures in matchdays, using the circle method so everyone plays once per
 * matchday (with a rest day each when the number of players is odd). The second time
 * round, home and away swap.
 */
export function leagueFixtures(t: Tournament): Omit<Fixture, 'match'>[] {
  const list: (string | null)[] = [...t.players]
  if (list.length % 2) list.push(null)
  const n = list.length
  const fixtures: Omit<Fixture, 'match'>[] = []
  for (let leg = 0; leg < t.league_rounds; leg++) {
    const order = [...list]
    for (let day = 0; day < n - 1; day++) {
      for (let i = 0; i < n / 2; i++) {
        const x = order[i]
        const y = order[n - 1 - i]
        if (!x || !y) continue
        const [home, away] = (day + leg) % 2 ? [y, x] : [x, y]
        fixtures.push({ round: leg * (n - 1) + day + 1, home, away })
      }
      order.splice(1, 0, order.pop()!)
    }
  }
  return fixtures
}

/** All of a tournament's results that count for it (disputed ones don't). */
export function tournamentMatches(t: Tournament, matches: Match[]) {
  return matches.filter((m) => m.tournament_id === t.id && m.status === 'ok')
}

export function tournamentState(t: Tournament, allMatches: Match[]): TournamentState {
  const matches = tournamentMatches(t, allMatches)
  const oldestFirst = chronological(matches)

  // League fixtures take that pair's league results in the order they were played.
  const used = new Set<string>()
  const fixtures: Fixture[] = leagueFixtures(t).map((f) => {
    const match = oldestFirst.find((m) => m.stage === 'league' && !used.has(m.id) && samePair(m, f.home, f.away)) ?? null
    if (match) used.add(match.id)
    return { ...f, match }
  })

  const rows = new Map<string, StandingRow>(
    t.players.map((id) => [id, { playerId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] }]),
  )
  for (const m of chronological(fixtures.flatMap((f) => (f.match ? [f.match] : [])))) {
    for (const id of [m.home_id, m.away_id]) {
      const r = rows.get(id)
      if (!r) continue
      const { gf, ga } = sideOf(m, id)
      const o = outcomeFor(m, id)
      r.played++
      r.gf += gf
      r.ga += ga
      r.gd = r.gf - r.ga
      if (o === 'W') r.won++
      else if (o === 'D') r.drawn++
      else r.lost++
      r.points = r.won * 3 + r.drawn
      r.form = [...r.form, o].slice(-5)
    }
  }
  const pick = new Map(t.players.map((id, i) => [id, i]))
  const table = [...rows.values()].sort(
    (x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || y.won - x.won || pick.get(x.playerId)! - pick.get(y.playerId)!,
  )
  const leagueDone = fixtures.every((f) => f.match)

  // Knockouts, seeded from the final league table.
  const rounds: KnockoutRound[] = []
  const size = t.knockout_size
  if (size !== 0) {
    const bracket = BRACKETS[size]
    const seeds = leagueDone ? table.slice(0, size).map((r) => r.playerId) : null
    let previous: Tie[] = []
    for (const [i, stage] of bracket.stages.entries()) {
      const ties: Tie[] =
        i === 0
          ? bracket.first.map(([x, y]) => ({
              stage,
              a: seeds?.[x - 1] ?? null,
              b: seeds?.[y - 1] ?? null,
              aFrom: ordinal(x),
              bFrom: ordinal(y),
              match: null,
              winner: null,
            }))
          : Array.from({ length: previous.length / 2 }, (_, j) => ({
              stage,
              a: previous[2 * j].winner,
              b: previous[2 * j + 1].winner,
              aFrom: `Winner ${SHORT[previous[0].stage]}${2 * j + 1}`,
              bFrom: `Winner ${SHORT[previous[0].stage]}${2 * j + 2}`,
              match: null,
              winner: null,
            }))
      for (const tie of ties) {
        if (!tie.a || !tie.b) continue
        tie.match = oldestFirst.find((m) => m.stage === stage && samePair(m, tie.a!, tie.b!) && winnerOf(m)) ?? null
        tie.winner = tie.match ? winnerOf(tie.match) : null
      }
      rounds.push({ stage, label: ROUND_LABELS[stage], ties })
      previous = ties
    }
  }

  const final = rounds.at(-1)?.ties[0]
  const champion = t.knockout_size === 0 ? (leagueDone ? (table[0]?.playerId ?? null) : null) : (final?.winner ?? null)
  const current = rounds.find((r) => r.ties.some((tie) => !tie.winner))
  const phase: TournamentState['phase'] = !leagueDone ? 'league' : current ? current.stage : 'finished'
  const open: OpenGame[] = !leagueDone
    ? fixtures.filter((f) => !f.match).map((f) => ({ stage: 'league', home: f.home, away: f.away }))
    : (current?.ties ?? [])
        .filter((tie) => tie.a && tie.b && !tie.winner)
        .map((tie) => ({ stage: tie.stage, home: tie.a!, away: tie.b! }))

  return { matches: [...oldestFirst].reverse(), fixtures, table, leagueDone, rounds, champion, phase, open }
}

/** The stage a result between two players would count for, or null if they have nothing left to play. */
export function stageFor(state: TournamentState, a: string, b: string): Stage | null {
  return state.open.find((g) => (g.home === a && g.away === b) || (g.home === b && g.away === a))?.stage ?? null
}

export function phaseLabel(phase: TournamentState['phase']) {
  return phase === 'finished' ? 'Finished' : phase === 'league' ? STAGE_LABELS.league : ROUND_LABELS[phase]
}

/** "Round robin (twice), then semi-finals and a final" */
export function formatSummary(t: Pick<Tournament, 'league_rounds' | 'knockout_size'>) {
  const league = t.league_rounds === 2 ? 'Round robin (twice)' : 'Round robin'
  if (t.knockout_size === 0) return `${league}, top of the table wins`
  if (t.knockout_size === 2) return `${league}, then a final`
  return `${league}, then ${t.knockout_size === 8 ? 'quarter-finals, semi-finals' : 'semi-finals'} and a final`
}

/** Games finished so far: played league fixtures and decided knockout ties. */
export function gamesPlayed(s: TournamentState) {
  return s.fixtures.filter((f) => f.match).length + s.rounds.reduce((n, r) => n + r.ties.filter((t) => t.winner).length, 0)
}

/** How many games the whole tournament takes. */
export function gamesInTotal(t: Pick<Tournament, 'league_rounds' | 'knockout_size'>, players: number) {
  return ((players * (players - 1)) / 2) * t.league_rounds + Math.max(0, t.knockout_size - 1)
}

export type TournamentStats = {
  played: number
  goals: number
  topScorers: { playerId: string; goals: number }[]
  cleanSheets: { playerId: string; count: number }[]
  biggestWin: Match | null
}

/** The tournament's own numbers, over all its results whether or not they count in the main stats. */
export function tournamentStats(t: Tournament, state: TournamentState): TournamentStats {
  const goals = new Map(t.players.map((id) => [id, 0]))
  const sheets = new Map(t.players.map((id) => [id, 0]))
  let biggestWin: Match | null = null
  const margin = (m: Match) => Math.abs(m.home_goals - m.away_goals)
  for (const m of state.matches) {
    for (const id of [m.home_id, m.away_id]) {
      const { gf, ga } = sideOf(m, id)
      goals.set(id, (goals.get(id) ?? 0) + gf)
      if (ga === 0) sheets.set(id, (sheets.get(id) ?? 0) + 1)
    }
    if (margin(m) > 0 && (!biggestWin || margin(m) > margin(biggestWin) || (margin(m) === margin(biggestWin) && m.home_goals + m.away_goals > biggestWin.home_goals + biggestWin.away_goals))) {
      biggestWin = m
    }
  }
  const ranked = <T extends { playerId: string }>(list: T[], value: (x: T) => number) =>
    list.filter((x) => value(x) > 0).sort((x, y) => value(y) - value(x))
  return {
    played: state.matches.length,
    goals: state.matches.reduce((n, m) => n + m.home_goals + m.away_goals, 0),
    topScorers: ranked([...goals].map(([playerId, n]) => ({ playerId, goals: n })), (x) => x.goals),
    cleanSheets: ranked([...sheets].map(([playerId, n]) => ({ playerId, count: n })), (x) => x.count),
    biggestWin,
  }
}
