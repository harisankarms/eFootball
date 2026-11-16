// Plain-text wording for records, shared by the screens and the notifications.
import type { League } from './queries'
import { recordInfo, type RecordBreak, type RecordKey, type RecordMark } from './records'
import { sideOf } from './stats'

/** The headline for a record: the score for single games, otherwise the number with its unit. */
export function recordHeadline(league: League, key: RecordKey, mark: RecordMark): string {
  const m = mark.match
  if (m && key === 'highest-scoring') return `${league.nameOf(m.home_id)} ${m.home_goals}–${m.away_goals} ${league.nameOf(m.away_id)}`
  if (m && (key === 'biggest-win' || key === 'most-goals-game')) {
    const { gf, ga, opponentId } = sideOf(m, mark.holder)
    return `${gf}–${ga} vs ${league.nameOf(opponentId)}`
  }
  return recordInfo.get(key)!.unit(mark.value)
}

/** Where tapping a record goes: the match, the week's table, or the holder. */
export function recordLink(key: RecordKey, mark: RecordMark): string {
  if (mark.match && key !== 'peak-rating' && recordInfo.get(key)!.group === 'game') return `/match/${mark.match.id}`
  if (mark.weekKey && (key === 'week-points' || key === 'week-goals' || key === 'best-card')) return `/table?at=${mark.weekKey}`
  return `/players/${mark.holder}`
}

/** One sentence about a record changing hands, for the news. */
export function breakSentence(league: League, b: RecordBreak): string {
  const info = recordInfo.get(b.key)!
  const name = league.nameOf(b.mark.holder)
  const now = recordHeadline(league, b.key, b.mark)
  const was = b.previous
    ? b.previous.holder === b.mark.holder
      ? ` Beats their own ${info.unit(b.previous.value)}.`
      : ` The old record was ${info.unit(b.previous.value)} by ${league.nameOf(b.previous.holder)}.`
    : ''
  const title = info.title[0].toLowerCase() + info.title.slice(1)
  return `${name} ${info.shame ? 'now holds an unwanted record' : 'set a new record'}: ${title}, ${now}.${was}`
}
