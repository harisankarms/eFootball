import { describe, expect, it } from 'vitest'
import { achievementStatuses, levelFor, playerTimelines, rarityOf, totalXp, unlocksFrom, xpForLevel } from './achievements'
import { pastWeeks } from './stats'
import { DEFAULT_SETTINGS, type Achievement, type Award, type Match } from './types'

const TZ = 'Asia/Kolkata'
let seq = 0
function mk(home: string, away: string, hg: number, ag: number, at: string, opts: Partial<Match> = {}): Match {
  seq++
  return {
    id: `m${seq}`,
    played_at: at,
    home_id: home,
    away_id: away,
    home_goals: hg,
    away_goals: ag,
    pens_winner_id: null,
    home_team: null,
    away_team: null,
    notes: null,
    screenshot_path: null,
    thumb_path: null,
    submitted_by: home,
    status: 'ok',
    dispute_reason: null,
    disputed_by: null,
    created_at: at,
    ...opts,
  }
}
function ach(partial: Partial<Achievement> & Pick<Achievement, 'id' | 'xp'>): Achievement {
  return {
    slug: null,
    name: partial.id,
    description: '',
    emoji: '🏆',
    kind: 'auto',
    metric: null,
    threshold: null,
    active: true,
    sort_order: 1,
    created_at: '2026-10-01T00:00:00Z',
    ...partial,
  }
}

// Tue 13 Oct 2026, 8 pm in India = 14:30 UTC
const day = (d: number, h = 14) => new Date(Date.UTC(2026, 9, d, h, 30)).toISOString()

describe('stat timelines', () => {
  const ms = [
    mk('a', 'b', 3, 0, day(13)), // hat-trick, clean sheet, margin 3
    mk('b', 'a', 1, 2, day(13, 15)), // win
    mk('a', 'c', 1, 1, day(13, 16), { pens_winner_id: 'a', submitted_by: 'c' }), // pens win
    mk('a', 'b', 0, 2, day(14)), // loss ends the runs
    mk('a', 'b', 6, 0, day(15), { status: 'disputed' }), // ignored
  ]
  const t = playerTimelines(ms, 'a', [], TZ)

  it('counts matches, wins and goals as they happen', () => {
    expect(t.matches_played.map((p) => p.value)).toEqual([1, 2, 3, 4])
    expect(t.wins.at(-1)).toEqual({ at: day(13, 16), value: 3 })
    expect(t.goals.at(-1)?.value).toBe(6)
  })

  it('tracks bests within a match and runs', () => {
    expect(t.goals_in_match.at(-1)?.value).toBe(3)
    expect(t.win_margin.at(-1)?.value).toBe(3)
    expect(t.win_streak.at(-1)?.value).toBe(3)
    expect(t.unbeaten_run.at(-1)?.value).toBe(3)
    expect(t.pens_wins.at(-1)?.value).toBe(1)
    expect(t.opponents_beaten.at(-1)?.value).toBe(2)
    expect(t.matches_in_day.at(-1)?.value).toBe(3)
    expect(t.clean_sheets.at(-1)?.value).toBe(1)
  })

  it('counts results logged by the player and ignores disputed ones', () => {
    // a logged the 1st, 4th and the disputed 5th; the others were logged by b and c.
    expect(t.results_logged.at(-1)?.value).toBe(2)
  })

  it('counts Player of the Week titles at the end of the week', () => {
    const lastWeek = [mk('a', 'b', 2, 0, day(6)), mk('a', 'b', 2, 0, day(7)), mk('a', 'b', 2, 0, day(8))]
    const weeks = pastWeeks(lastWeek, DEFAULT_SETTINGS, '2026-10-12')
    const tw = playerTimelines(lastWeek, 'a', weeks, TZ)
    expect(tw.potw).toEqual([{ at: '2026-10-11T18:30:00.000Z', value: 1 }])
    expect(tw.golden_boots.at(-1)?.value).toBe(1)
  })
})

describe('achievements from screenshot stats', () => {
  const ms = [
    // a is home: 179/199 = 89.9% passing, 61% possession, 12 on target, opponent 0 on target
    mk('a', 'b', 3, 0, day(13), {
      details: { stats: { passes: [199, 150], successful_passes: [179, 120], possession: [61, 39], shots_on_target: [12, 0], tackles: [18, 9] } },
    }),
    // a is away: 27/28 passes is too few to count; 26 tackles
    mk('b', 'a', 1, 1, day(14), { details: { stats: { passes: [210, 28], successful_passes: [190, 27], shots_on_target: [3, 2], tackles: [10, 26] } } }),
    // no stats read: counts for everything else but not these
    mk('a', 'b', 2, 1, day(15)),
  ]
  const t = playerTimelines(ms, 'a', [], TZ)

  it('tracks the best pass accuracy, rounding down and ignoring matches with few passes', () => {
    expect(t.pass_accuracy.map((p) => p.value)).toEqual([89])
  })

  it('reads each stat from the player own side', () => {
    expect(t.possession.at(-1)?.value).toBe(61)
    expect(t.shots_on_target_in_match.at(-1)?.value).toBe(12)
    expect(t.tackles_in_match.map((p) => p.value)).toEqual([18, 26])
  })

  it('counts matches where the opponent had no shots on target', () => {
    expect(t.zero_shots_against.map((p) => p.value)).toEqual([1])
    expect(playerTimelines(ms, 'b', [], TZ).zero_shots_against).toEqual([])
  })
})

describe('achievement statuses', () => {
  const ms = [mk('a', 'b', 1, 0, day(13)), mk('a', 'b', 2, 0, day(14)), mk('a', 'b', 0, 1, day(15))]
  const t = playerTimelines(ms, 'a', [], TZ)
  const list = [
    ach({ id: 'two-wins', xp: 50, metric: 'wins', threshold: 2 }),
    ach({ id: 'ten-wins', xp: 100, metric: 'wins', threshold: 10 }),
    ach({ id: 'epic', xp: 100, kind: 'manual' }),
    ach({ id: 'hidden', xp: 999, metric: 'wins', threshold: 1, active: false }),
  ]
  const awards: Award[] = [{ player_id: 'a', achievement_id: 'epic', awarded_at: day(16), awarded_by: 'x', note: null }]
  const s = achievementStatuses(list, awards, t, 'a')

  it('unlocks automatic achievements on the day the target was reached', () => {
    expect(s.find((x) => x.achievement.id === 'two-wins')).toMatchObject({ unlocked: true, unlockedAt: day(14), current: 2 })
  })

  it('shows progress on locked ones', () => {
    expect(s.find((x) => x.achievement.id === 'ten-wins')).toMatchObject({ unlocked: false, current: 2, target: 10 })
  })

  it('unlocks awarded achievements and skips hidden ones', () => {
    expect(s.find((x) => x.achievement.id === 'epic')).toMatchObject({ unlocked: true, unlockedAt: day(16) })
    expect(s.some((x) => x.achievement.id === 'hidden')).toBe(false)
    expect(totalXp(s)).toBe(150)
  })

  it('treats an admin award as unlocking an automatic achievement too', () => {
    const extra: Award[] = [{ player_id: 'a', achievement_id: 'ten-wins', awarded_at: day(17), awarded_by: 'x', note: null }]
    expect(achievementStatuses(list, extra, t, 'a').find((x) => x.achievement.id === 'ten-wins')?.unlocked).toBe(true)
  })
})

describe('unlocks from a new result', () => {
  it('reports newly unlocked achievements and a level up', () => {
    const list = [
      ach({ id: 'first', xp: 50, metric: 'matches_played', threshold: 1 }),
      ach({ id: 'win', xp: 60, metric: 'wins', threshold: 1 }),
      ach({ id: 'hattrick', xp: 75, metric: 'goals_in_match', threshold: 3 }),
    ]
    const before = [mk('a', 'b', 0, 1, day(13))]
    const result = unlocksFrom(list, [], before, mk('a', 'b', 3, 0, day(14)), 'a', [], TZ)
    expect(result.unlocked.map((x) => x.id)).toEqual(['win', 'hattrick'])
    expect(result.levelUp?.level).toBe(2)
  })
})

describe('levels', () => {
  it('needs more XP for each level', () => {
    expect([1, 2, 3, 4, 10].map(xpForLevel)).toEqual([0, 100, 300, 600, 4500])
  })

  it('works out the level, title and progress', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Rookie', progress: 0 })
    expect(levelFor(250)).toMatchObject({ level: 2, title: 'Academy Prospect', floor: 100, next: 300, progress: 0.75 })
    expect(levelFor(300).level).toBe(3)
    expect(levelFor(4500)).toMatchObject({ level: 10, title: 'Legend' })
    expect(levelFor(1_000_000).title).toBe('GOAT')
  })

  it('grades rarity by XP', () => {
    expect([25, 100, 200, 500].map(rarityOf)).toEqual(['common', 'rare', 'epic', 'legendary'])
  })
})
