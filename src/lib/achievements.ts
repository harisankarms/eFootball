// Achievements, XP and levels. Automatic achievements are worked out from the
// match list, like every other stat, so they always match the results.
import { sidesOf } from './matchStats'
import { chronological, isCounted, outcomeFor, sideOf, type WeekResult } from './stats'
import { addDays, dayKey, startOfDay } from './time'
import type { Achievement, Award, Match } from './types'

/** Pass accuracy only counts for matches with at least this many passes, so a handful of passes can't make 100%. */
export const MIN_PASSES_FOR_ACCURACY = 30

export const METRICS = {
  matches_played: { label: 'Matches played', unit: 'matches' },
  wins: { label: 'Wins', unit: 'wins' },
  goals: { label: 'Goals scored', unit: 'goals' },
  clean_sheets: { label: 'Clean sheets', unit: 'clean sheets' },
  goals_in_match: { label: 'Goals in a single match', unit: 'goals' },
  win_margin: { label: 'Winning margin in a match', unit: 'goals' },
  win_streak: { label: 'Wins in a row', unit: 'wins in a row' },
  unbeaten_run: { label: 'Matches unbeaten in a row', unit: 'unbeaten' },
  pens_wins: { label: 'Penalty shootout wins', unit: 'shootouts' },
  potw: { label: 'Player of the Week titles', unit: 'titles' },
  golden_boots: { label: 'Weekly Golden Boots', unit: 'Golden Boots' },
  opponents_beaten: { label: 'Different opponents beaten', unit: 'opponents' },
  matches_in_day: { label: 'Matches played in one day', unit: 'in a day' },
  results_logged: { label: 'Results logged', unit: 'results' },
  pass_accuracy: { label: 'Pass accuracy in a match (%)', unit: '% passing' },
  possession: { label: 'Possession in a match (%)', unit: '% possession' },
  shots_on_target_in_match: { label: 'Shots on target in a match', unit: 'on target' },
  tackles_in_match: { label: 'Tackles in a match', unit: 'tackles' },
  zero_shots_against: { label: 'Matches facing no shots on target', unit: 'matches' },
} as const

export type MetricKey = keyof typeof METRICS
export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[]
export const isMetric = (k: string | null): k is MetricKey => !!k && k in METRICS

export type Point = { at: string; value: number }
/** For each stat, every moment it reached a new high, oldest first. */
export type Timelines = Record<MetricKey, Point[]>

export function playerTimelines(matches: Match[], playerId: string, pastWeeks: WeekResult[], tz: string): Timelines {
  const t = Object.fromEntries(METRIC_KEYS.map((k) => [k, [] as Point[]])) as Timelines
  const push = (k: MetricKey, at: string, value: number) => {
    const s = t[k]
    if (value > 0 && (!s.length || value > s[s.length - 1].value)) s.push({ at, value })
  }

  let played = 0
  let wins = 0
  let goals = 0
  let cleanSheets = 0
  let bestGoals = 0
  let bestMargin = 0
  let winRun = 0
  let bestWinRun = 0
  let unbeaten = 0
  let bestUnbeaten = 0
  let pens = 0
  let bestDay = 0
  let bestPassing = 0
  let bestPossession = 0
  let bestOnTarget = 0
  let bestTackles = 0
  let noShotsFaced = 0
  const beaten = new Set<string>()
  const perDay = new Map<string, number>()

  const mine = chronological(matches.filter((m) => isCounted(m) && (m.home_id === playerId || m.away_id === playerId)))
  for (const m of mine) {
    const at = m.played_at
    const { gf, ga, opponentId } = sideOf(m, playerId)
    const o = outcomeFor(m, playerId)

    push('matches_played', at, ++played)
    goals += gf
    push('goals', at, goals)
    bestGoals = Math.max(bestGoals, gf)
    push('goals_in_match', at, bestGoals)
    if (ga === 0) push('clean_sheets', at, ++cleanSheets)
    if (o === 'W') {
      push('wins', at, ++wins)
      beaten.add(opponentId)
      push('opponents_beaten', at, beaten.size)
      if (m.pens_winner_id) push('pens_wins', at, ++pens)
    }
    if (gf > ga) {
      bestMargin = Math.max(bestMargin, gf - ga)
      push('win_margin', at, bestMargin)
    }
    winRun = o === 'W' ? winRun + 1 : 0
    bestWinRun = Math.max(bestWinRun, winRun)
    push('win_streak', at, bestWinRun)
    unbeaten = o === 'L' ? 0 : unbeaten + 1
    bestUnbeaten = Math.max(bestUnbeaten, unbeaten)
    push('unbeaten_run', at, bestUnbeaten)
    const day = dayKey(at, tz)
    const count = (perDay.get(day) ?? 0) + 1
    perDay.set(day, count)
    bestDay = Math.max(bestDay, count)
    push('matches_in_day', at, bestDay)

    // Stats read from the full-time screenshot, when there was one.
    const sides = sidesOf(m, playerId)
    if (sides) {
      const { mine, theirs } = sides
      if (mine.passes != null && mine.successful_passes != null && mine.passes >= MIN_PASSES_FOR_ACCURACY) {
        bestPassing = Math.max(bestPassing, Math.floor((mine.successful_passes / mine.passes) * 100))
        push('pass_accuracy', at, bestPassing)
      }
      if (mine.possession != null) {
        bestPossession = Math.max(bestPossession, mine.possession)
        push('possession', at, bestPossession)
      }
      if (mine.shots_on_target != null) {
        bestOnTarget = Math.max(bestOnTarget, mine.shots_on_target)
        push('shots_on_target_in_match', at, bestOnTarget)
      }
      if (mine.tackles != null) {
        bestTackles = Math.max(bestTackles, mine.tackles)
        push('tackles_in_match', at, bestTackles)
      }
      if (theirs.shots_on_target === 0) push('zero_shots_against', at, ++noShotsFaced)
    }
  }

  let logged = 0
  const loggedByMe = matches
    .filter((m) => isCounted(m) && m.submitted_by === playerId)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  for (const m of loggedByMe) push('results_logged', m.created_at, ++logged)

  let potw = 0
  let boots = 0
  for (const w of [...pastWeeks].sort((a, b) => a.weekKey.localeCompare(b.weekKey))) {
    const ended = startOfDay(addDays(w.weekKey, 7), tz).toISOString()
    if (w.winner?.playerId === playerId) push('potw', ended, ++potw)
    if (w.awards.goldenBoot?.ids.includes(playerId)) push('golden_boots', ended, ++boots)
  }
  return t
}

export type AchievementStatus = {
  achievement: Achievement
  unlocked: boolean
  unlockedAt: string | null
  /** Current value of the stat (automatic) or 0/1 (awarded). */
  current: number
  target: number
}

export function achievementStatuses(achievements: Achievement[], awards: Award[], timelines: Timelines, playerId: string): AchievementStatus[] {
  return achievements
    .filter((a) => a.active)
    .map((a) => {
      const award = awards.find((w) => w.player_id === playerId && w.achievement_id === a.id)
      if (a.kind === 'auto' && isMetric(a.metric) && a.threshold) {
        const series = timelines[a.metric]
        const hit = series.find((p) => p.value >= a.threshold!)
        const unlockedAt = hit?.at ?? award?.awarded_at ?? null
        return { achievement: a, unlocked: !!unlockedAt, unlockedAt, current: series[series.length - 1]?.value ?? 0, target: a.threshold }
      }
      return { achievement: a, unlocked: !!award, unlockedAt: award?.awarded_at ?? null, current: award ? 1 : 0, target: 1 }
    })
}

export function totalXp(statuses: AchievementStatus[]): number {
  return statuses.reduce((sum, s) => sum + (s.unlocked ? s.achievement.xp : 0), 0)
}

export const LEVEL_TITLES = [
  'Rookie',
  'Academy Prospect',
  'Squad Player',
  'First Teamer',
  'Regular Starter',
  'Fan Favourite',
  'Star Player',
  'Captain',
  'World Class',
  'Legend',
  'Icon',
  'GOAT',
]

/** Total XP needed to reach a level: 0, 100, 300, 600, 1000, 1500, ... */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export type LevelInfo = {
  level: number
  title: string
  xp: number
  /** XP where this level started and where the next one begins. */
  floor: number
  next: number
  /** 0 to 1 through the current level. */
  progress: number
}

export function levelFor(xp: number): LevelInfo {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const floor = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return {
    level,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
    xp,
    floor,
    next,
    progress: (xp - floor) / (next - floor),
  }
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export function rarityOf(xp: number): Rarity {
  if (xp >= 400) return 'legendary'
  if (xp >= 200) return 'epic'
  if (xp >= 100) return 'rare'
  return 'common'
}

/** What a new result unlocks for a player: achievements, and a new level if they went up one. */
export function unlocksFrom(
  achievements: Achievement[],
  awards: Award[],
  matchesBefore: Match[],
  newMatch: Match,
  playerId: string,
  pastWeeks: WeekResult[],
  tz: string,
): { unlocked: Achievement[]; levelUp: LevelInfo | null } {
  const before = achievementStatuses(achievements, awards, playerTimelines(matchesBefore, playerId, pastWeeks, tz), playerId)
  const after = achievementStatuses(achievements, awards, playerTimelines([...matchesBefore, newMatch], playerId, pastWeeks, tz), playerId)
  const had = new Set(before.filter((s) => s.unlocked).map((s) => s.achievement.id))
  const levelBefore = levelFor(totalXp(before))
  const levelAfter = levelFor(totalXp(after))
  return {
    unlocked: after.filter((s) => s.unlocked && !had.has(s.achievement.id)).map((s) => s.achievement),
    levelUp: levelAfter.level > levelBefore.level ? levelAfter : null,
  }
}

/** A short "37 / 50 goals" style progress label for an automatic achievement. */
export function progressLabel(s: AchievementStatus): string | null {
  const a = s.achievement
  if (a.kind !== 'auto' || !isMetric(a.metric)) return null
  const unit = METRICS[a.metric].unit
  return `${Math.min(s.current, s.target)} / ${s.target}${unit.startsWith('%') ? '' : ' '}${unit}`
}
