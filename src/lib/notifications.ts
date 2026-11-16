// What each notification says and who gets it. Pure functions: the app calls them with the league
// it already has and hands the result to sendPush (see push.ts).

import type { PushMessage } from './push'
import type { League } from './queries'
import { newsworthy, recordBook, recordInfo, type RecordKey } from './records'
import { breakSentence } from './recordText'
import { seasonSpan, type SeasonResult } from './seasons'
import { formatPerGame, formatPoints, type MonthResult, type WeekResult } from './stats'
import { monthLabel, weekKey, weekLabel } from './time'
import type { Challenge, Match } from './types'

export function scoreLine(league: League, m: Match) {
  const pens = m.pens_winner_id ? ` (${league.nameOf(m.pens_winner_id)} on pens)` : ''
  return `${league.nameOf(m.home_id)} ${m.home_goals}–${m.away_goals} ${league.nameOf(m.away_id)}${pens}`
}

const others = (league: League, exclude: string[]) =>
  league.players.filter((p) => p.active && !exclude.includes(p.id)).map((p) => p.id)

/** A new result: to the players in it (not whoever logged it), and to everyone who follows every result. */
export function resultMessages(league: League, match: Match, by: string): PushMessage[] {
  const out: PushMessage[] = []
  const players = [match.home_id, match.away_id].filter((id) => id !== by)
  if (players.length) {
    out.push({
      key: `match:${match.id}:players`,
      topic: 'results',
      title: `${league.nameOf(by)} logged a result`,
      body: `${scoreLine(league, match)}. Wrong? You have ${league.settings.dispute_hours} hours to dispute it.`,
      url: `/match/${match.id}`,
      to: players,
    })
  }
  const rest = others(league, [match.home_id, match.away_id, by])
  if (rest.length) {
    out.push({ key: `match:${match.id}:all`, topic: 'all-results', title: 'New result', body: scoreLine(league, match), url: `/match/${match.id}`, to: rest })
  }
  return out
}

/** Streaks only make news when they change hands, not every game they grow by. */
const RUNS = new Set<RecordKey>(['win-streak', 'unbeaten', 'clean-sheet-run', 'scoring-run', 'losing-run', 'peak-rating'])

/** Records a new result broke (the ones worth news), to everyone. `matches` includes the new result. */
export function recordMessages(league: League, matches: Match[], match: Match, now: Date): PushMessage[] {
  const week = weekKey(now, league.tz)
  const before = recordBook(
    matches.filter((m) => m.id !== match.id),
    league.settings,
    week,
  )
  return newsworthy(recordBook(matches, league.settings, week))
    .filter((b) => b.mark.match?.id === match.id)
    .filter((b) => !(RUNS.has(b.key) && before.current.get(b.key)?.holder === b.mark.holder))
    .map((b) => {
      const info = recordInfo.get(b.key)!
      return {
        key: `record:${b.key}:${match.id}`,
        topic: 'records' as const,
        title: `${info.shame ? 'Unwanted record' : 'Record broken'}: ${info.title}`,
        body: breakSentence(league, b),
        url: '/records',
        to: 'all' as const,
      }
    })
}

const stamp = (now: Date) => now.toISOString().slice(0, 16).replace(/[-:T]/g, '')

/** A disputed result: to whoever logged it and the admins. */
export function disputeMessage(league: League, match: Match, by: string, reason: string, now = new Date()): PushMessage {
  const admins = league.players.filter((p) => p.active && p.is_admin).map((p) => p.id)
  const to = [...new Set([match.submitted_by, ...admins])].filter((id): id is string => !!id && id !== by)
  const why = reason.trim() ? `: “${reason.trim().slice(0, 80)}”` : ''
  return {
    key: `dispute:${match.id}:${stamp(now)}`,
    topic: 'disputes',
    title: `${league.nameOf(by)} disputed a result`,
    body: `${scoreLine(league, match)}${why}. It doesn't count until an admin checks it.`,
    url: `/match/${match.id}`,
    to,
  }
}

/** A dispute settled by an admin: to both players and whoever logged it. */
export function resolvedMessage(league: League, match: Match, by: string, now = new Date()): PushMessage {
  const to = [...new Set([match.home_id, match.away_id, match.submitted_by])].filter((id): id is string => !!id && id !== by)
  return {
    key: `resolved:${match.id}:${stamp(now)}`,
    topic: 'disputes',
    title: 'Dispute settled',
    body: `${scoreLine(league, match)} stands and counts again.`,
    url: `/match/${match.id}`,
    to,
  }
}

/** The week's winners, once the week is over: to everyone. */
export function weekMessage(league: League, week: WeekResult): PushMessage | null {
  const w = week.winner
  const c = week.awards.chenda
  if (!w && !c) return null
  const parts = [
    w ? `${formatPoints(w.points)} pts from ${w.played} games.` : `Nobody played enough games to be crowned.`,
    c ? `${league.nameOf(c.playerId)} got the chenda 🥁 (${formatPerGame(c)} pts a game).` : '',
    'Tap for the week in review.',
  ]
  return {
    key: `week:${week.weekKey}`,
    topic: 'winners',
    title: w ? `👑 ${league.nameOf(w.playerId)} is Player of the Week` : `The week of ${weekLabel(week.weekKey)} is over`,
    body: parts.filter(Boolean).join(' '),
    url: `/?recap=${week.weekKey}`,
    to: 'all',
  }
}

/** The month's winner, once the month is over: to everyone. */
export function monthMessage(league: League, month: MonthResult): PushMessage | null {
  const w = month.winner
  if (!w) return null
  return {
    key: `month:${month.monthKey}`,
    topic: 'winners',
    title: `🏆 ${league.nameOf(w.playerId)} is Player of the Month`,
    body: `${monthLabel(month.monthKey)}: ${formatPoints(w.points)} pts from ${w.played} games. Tap to reveal the card.`,
    url: '/',
    to: 'all',
  }
}

/** The season's champion, once the season is over: to everyone. */
export function seasonMessage(league: League, season: SeasonResult, name: string): PushMessage | null {
  const c = season.champion
  if (!c) return null
  return {
    key: `season:${season.key}`,
    topic: 'winners',
    title: `🏆 ${league.nameOf(c.playerId)} wins ${name}`,
    body: `${seasonSpan(season.key)}: ${formatPoints(c.points)} pts from ${c.played} games. Tap for the season review.`,
    url: `/?season=${season.key}`,
    to: 'all',
  }
}

/** A new challenge: to the challenged player. */
export function challengeMessage(league: League, c: Challenge): PushMessage {
  return {
    key: `challenge:${c.id}`,
    topic: 'challenges',
    title: `${league.nameOf(c.from_id)} challenged you`,
    body: c.message ? `“${c.message.slice(0, 120)}” Accept or decline in the app.` : 'Fancy a game? Accept or decline in the app.',
    url: '/#challenges',
    to: [c.to_id],
  }
}

/** An answer to a challenge: to whoever sent it. */
export function answerMessage(league: League, c: Challenge, status: 'accepted' | 'declined'): PushMessage {
  const name = league.nameOf(c.to_id)
  return {
    key: `challenge:${c.id}:${status}`,
    topic: 'challenges',
    title: status === 'accepted' ? `${name} accepted your challenge` : `${name} declined your challenge`,
    body: status === 'accepted' ? "Game on. Log the result when you've played." : 'Maybe another time.',
    url: '/#challenges',
    to: [c.from_id],
  }
}
