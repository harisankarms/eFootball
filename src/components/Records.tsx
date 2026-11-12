import {
  BrickWall,
  Crosshair,
  Crown,
  Drum,
  Flame,
  Footprints,
  Goal,
  Medal,
  Repeat,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useNow, type League } from '../lib/queries'
import { newsworthy, recordBook, recordInfo, type RecordBreak, type RecordKey, type RecordMark } from '../lib/records'
import { sideOf } from '../lib/stats'
import { relativeTime, weekKey } from '../lib/time'
import type { Announcement } from '../lib/types'
import { Avatar } from './Avatar'
import { GlowIcon, type Tint } from './ui'

export const RECORD_ICONS: Record<RecordKey, { icon: LucideIcon; tint: Tint }> = {
  'biggest-win': { icon: Zap, tint: 'accent' },
  'most-goals-game': { icon: Goal, tint: 'gold' },
  'highest-scoring': { icon: Sparkles, tint: 'violet' },
  'win-streak': { icon: Flame, tint: 'gold' },
  unbeaten: { icon: ShieldCheck, tint: 'accent' },
  'clean-sheet-run': { icon: BrickWall, tint: 'cyan' },
  'scoring-run': { icon: Crosshair, tint: 'gold' },
  'losing-run': { icon: TrendingDown, tint: 'ember' },
  'week-points': { icon: Crown, tint: 'gold' },
  'week-goals': { icon: Footprints, tint: 'gold' },
  'best-card': { icon: Star, tint: 'violet' },
  'potw-crowns': { icon: Trophy, tint: 'gold' },
  'potw-row': { icon: Repeat, tint: 'cyan' },
  chendas: { icon: Drum, tint: 'ember' },
  'peak-rating': { icon: TrendingUp, tint: 'accent' },
}

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

export type NewsItem = { kind: 'post'; at: string; post: Announcement } | { kind: 'record'; at: string; record: RecordBreak }

/** The squad's posts with the app's own record-broken items, newest first. */
export function useNewsFeed(league: League | null, posts: Announcement[] | undefined): NewsItem[] | null {
  const now = useNow()
  const week = league ? weekKey(now, league.tz) : ''
  const records = useMemo(() => (league ? newsworthy(recordBook(league.matches, league.settings, week)) : []), [league, week])
  return useMemo(() => {
    if (!posts) return null
    const items: NewsItem[] = [
      ...posts.map((post) => ({ kind: 'post' as const, at: post.created_at, post })),
      ...records.map((record) => ({ kind: 'record' as const, at: record.mark.at, record })),
    ]
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  }, [posts, records])
}

/** A record-broken item in the news, posted by the app itself. */
export function RecordNewsCard({ league, item }: { league: League; item: RecordBreak }) {
  const now = useNow()
  const { icon, tint } = RECORD_ICONS[item.key]
  const info = recordInfo.get(item.key)!
  return (
    <Link to="/records" className="card card-hover block animate-rise overflow-hidden p-4">
      <div aria-hidden className="pointer-events-none absolute -top-14 -right-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgb(255_207_77/0.16),transparent_70%)]" />
      <header className="relative flex items-center gap-3">
        <GlowIcon icon={icon} tint={tint} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-gold uppercase">
            <Medal className="h-3.5 w-3.5" aria-hidden />
            {info.shame ? 'Unwanted record' : 'Record broken'}
          </div>
          <div className="truncate font-semibold">{info.title}</div>
        </div>
        <span className="shrink-0 text-xs text-muted">{relativeTime(item.mark.at, league.tz, now)}</span>
      </header>
      <div className="relative mt-3 flex items-center gap-3">
        <Avatar league={league} id={item.mark.holder} size={34} ring={info.shame ? undefined : 'gold'} />
        <p className="text-[15px] leading-snug">{breakSentence(league, item)}</p>
      </div>
    </Link>
  )
}
