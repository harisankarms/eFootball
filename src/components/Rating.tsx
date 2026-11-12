import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link } from 'react-router'
import type { League } from '../lib/queries'
import { START_RATING, changeSince, formatChange, formatRating, type RatingPoint, type Ratings } from '../lib/rating'
import { sideOf } from '../lib/stats'
import { dayKey, dayMonth, shortDate, startOfDay, weekKey } from '../lib/time'
import { Avatar } from './Avatar'
import { LineChart, type ChartSeries } from './LineChart'
import { SectionTitle } from './ui'

const RESULT_WORD = { W: 'Won', D: 'Drew', L: 'Lost' } as const

function Change({ value, suffix }: { value: number; suffix?: string }) {
  const r = Math.round(value)
  const Icon = r < 0 ? TrendingDown : TrendingUp
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${r > 0 ? 'text-accent' : r < 0 ? 'text-[#ff9b9b]' : 'text-muted'}`}>
      {r !== 0 && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {formatChange(value)}
      {suffix && <span className="text-muted">{suffix}</span>}
    </span>
  )
}

/** Ticks for a game-number axis: 0 (the start) and a few round numbers. */
function gameTicks(min: number, max: number, count: number) {
  const step = Math.max(1, Math.ceil(max / count / 5) * 5 || 1)
  const out: { x: number; label: string }[] = []
  for (let x = min; x <= max; x += step) out.push({ x, label: x === 0 ? 'Start' : String(x) })
  return out
}

function scoreLine(league: League, p: RatingPoint, id: string) {
  const { gf, ga } = sideOf(p.match, id)
  const pens = p.match.pens_winner_id ? ' (pens)' : ''
  return `${RESULT_WORD[p.outcome]} ${gf}–${ga}${pens} vs ${league.nameOf(p.opponentId)}`
}

/** A player's form rating on their profile: the number, their place, and the line over every game. */
export function RatingPanel({ league, id, all, now }: { league: League; id: string; all: Ratings; now: Date }) {
  const history = all.history.get(id)
  const series = useMemo<ChartSeries[]>(
    () =>
      history
        ? [{ id, name: league.nameOf(id), color: league.colorOf(id), points: [{ x: 0, y: START_RATING }, ...history.map((p, i) => ({ x: i + 1, y: p.rating }))] }]
        : [],
    [history, id, league],
  )
  const tooltip = useCallback(
    (x: number) => {
      if (!history || x === 0) return <div className="font-semibold text-ink">Start · {formatRating(START_RATING)}</div>
      const p = history[x - 1]
      return (
        <>
          <div className="text-muted">
            Game {x} · {shortDate(p.match.played_at, league.tz)}
          </div>
          <div className="mt-0.5 text-ink-2">{scoreLine(league, p, id)}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink tabular-nums">{formatRating(p.rating)}</span>
            <Change value={p.change} />
          </div>
        </>
      )
    },
    [history, id, league],
  )
  if (!history?.length) return null

  const rating = all.current.get(id) ?? START_RATING
  const weekStart = startOfDay(weekKey(now, league.tz), league.tz).getTime()
  const thisWeek = changeSince(history, weekStart)
  const playedThisWeek = history.some((p) => Date.parse(p.match.played_at) >= weekStart)
  const peak = all.peak.get(id)
  const rank = all.rank.get(id)

  return (
    <section>
      <SectionTitle title="Form rating" action={<span className="text-xs text-muted">#{rank} of {all.current.size}</span>} />
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="font-display text-5xl leading-none font-bold tabular-nums">{formatRating(rating)}</div>
            <div className="mt-1 text-xs text-muted">After {history.length} games</div>
          </div>
          <div className="flex gap-5 pb-0.5 text-sm">
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">This week</div>
              {playedThisWeek ? <Change value={thisWeek} /> : <span className="text-muted">No games</span>}
            </div>
            {peak && (
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">Peak</div>
                <span className="font-semibold tabular-nums">{formatRating(peak.rating)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <LineChart
            series={series}
            area
            label={`${league.nameOf(id)}'s form rating over ${history.length} games, from ${formatRating(START_RATING)} to ${formatRating(rating)}`}
            baseline={{ y: START_RATING, label: 'Start' }}
            xTicks={gameTicks}
            formatY={formatRating}
            tooltip={tooltip}
          />
          <p className="mt-2 text-xs text-muted">
            Everyone starts on {formatRating(START_RATING)}. Beat someone rated higher to gain more; big wins count a little extra.
          </p>
        </div>
      </div>
    </section>
  )
}

type DayEnd = { rating: number; change: number; games: number }

/** Each player's rating at the end of every day they played, so the lines stay readable. */
function byDay(all: Ratings, tz: string) {
  const days = new Map<string, Map<string, DayEnd>>()
  for (const [id, history] of all.history) {
    for (const p of history) {
      const day = dayKey(p.match.played_at, tz)
      let players = days.get(day)
      if (!players) days.set(day, (players = new Map()))
      const prev = players.get(id)
      players.set(id, { rating: p.rating, change: (prev?.change ?? 0) + p.change, games: (prev?.games ?? 0) + 1 })
    }
  }
  const keys = [...days.keys()].sort()
  // Noon that day, so every player's point for a day sits at the same spot.
  const xOf = new Map(keys.map((k) => [k, startOfDay(k, tz).getTime() + 12 * 3600_000]))
  const dayOf = new Map(keys.map((k) => [xOf.get(k)!, k]))
  return { days, keys, xOf, dayOf }
}

/** Everyone's form rating on the Players page: the lines together, then the ranking. */
export function RatingsCard({ league, all, now }: { league: League; all: Ratings; now: Date }) {
  const order = useMemo(() => [...all.current.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id), [all])
  const daily = useMemo(() => byDay(all, league.tz), [all, league.tz])
  const series = useMemo<ChartSeries[]>(
    () =>
      order.map((id) => ({
        id,
        name: league.nameOf(id),
        color: league.colorOf(id),
        points: daily.keys.filter((k) => daily.days.get(k)!.has(id)).map((k) => ({ x: daily.xOf.get(k)!, y: daily.days.get(k)!.get(id)!.rating })),
      })),
    [order, daily, league],
  )
  const timeTicks = useCallback(
    (min: number, max: number, count: number) => {
      const out: { x: number; label: string }[] = []
      const seen = new Set<string>()
      for (let i = 0; i < count; i++) {
        const x = min + ((max - min) * (0.06 + (0.88 * i) / Math.max(1, count - 1)))
        const label = dayMonth(x, league.tz)
        if (!seen.has(label)) out.push({ x, label })
        seen.add(label)
      }
      return out
    },
    [league.tz],
  )
  const tooltip = useCallback(
    (x: number) => {
      const day = daily.dayOf.get(x)
      if (!day) return null
      const games = daily.keys.length ? [...daily.days.get(day)!.values()].reduce((s, d) => s + d.games, 0) / 2 : 0
      // Each player's rating at the end of that day, whether or not they played.
      const rows = order
        .map((id) => {
          const last = [...daily.keys].reverse().find((k) => k <= day && daily.days.get(k)!.has(id))
          return { id, end: last ? daily.days.get(last)!.get(id)! : null, played: daily.days.get(day)!.get(id) ?? null }
        })
        .filter((r) => r.end)
        .sort((a, b) => b.end!.rating - a.end!.rating)
      return (
        <>
          <div className="text-muted">
            {shortDate(startOfDay(day, league.tz), league.tz)} · {games} game{games === 1 ? '' : 's'}
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {rows.map(({ id, end, played }) => (
              <li key={id} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: league.colorOf(id) }} />
                <span className="min-w-0 flex-1 truncate text-ink-2">{league.nameOf(id)}</span>
                <span className="font-semibold text-ink tabular-nums">{formatRating(end!.rating)}</span>
                {played && <Change value={played.change} />}
              </li>
            ))}
          </ul>
        </>
      )
    },
    [daily, order, league],
  )
  if (!order.length) return null

  const weekStart = startOfDay(weekKey(now, league.tz), league.tz).getTime()
  return (
    <section className="mb-6">
      <SectionTitle title="Form ratings" />
      <div className="card p-4">
        <LineChart
          series={series}
          label={`Form ratings over time. Now: ${order.map((id) => `${league.nameOf(id)} ${formatRating(all.current.get(id)!)}`).join(', ')}`}
          baseline={{ y: START_RATING, label: '' }}
          xTicks={timeTicks}
          formatY={formatRating}
          tooltip={tooltip}
        />
        <ol className="mt-4 divide-y divide-line/70 border-t border-line/70">
          {order.map((id) => {
            const history = all.history.get(id) ?? []
            const played = history.some((p) => Date.parse(p.match.played_at) >= weekStart)
            return (
              <li key={id}>
                <Link to={`/players/${id}`} className="flex items-center gap-3 py-2.5 transition hover:bg-surface-2/40">
                  <span className={`w-5 text-center text-xs font-semibold tabular-nums ${all.rank.get(id) === 1 ? 'text-gold' : 'text-muted'}`}>
                    {all.rank.get(id)}
                  </span>
                  <Avatar league={league} id={id} size={30} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{league.nameOf(id)}</span>
                  <span className="text-xs">{played ? <Change value={changeSince(history, weekStart)} suffix=" this week" /> : null}</span>
                  <span className="w-14 text-right font-semibold tabular-nums">{formatRating(all.current.get(id)!)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-xs text-muted">
          Like chess ratings: everyone starts on {formatRating(START_RATING)} (the dashed line), and beating someone rated higher earns
          more. The chart shows each player's rating at the end of every day they played.
        </p>
      </div>
    </section>
  )
}
