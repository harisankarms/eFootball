import { CalendarDays, ChevronLeft, ChevronRight, Crown, Drum, Info, ListOrdered } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { StandingsTable } from '../components/StandingsTable'
import { StatLeaders } from '../components/StatLeaders'
import { EmptyState, ErrorState, PageSkeleton, PageTitle, SectionTitle, Segmented } from '../components/ui'
import { statLeaders } from '../lib/matchStats'
import { useLeague, useNow } from '../lib/queries'
import { buildTable, formatPerGame, formatPoints, isCounted, monthMinimum, monthResult, weekResult, type Row } from '../lib/stats'
import { addDays, addMonths, monthKey, monthLabel, startOfDay, weekKey, weekLabel } from '../lib/time'
import type { Match } from '../lib/types'

type View = 'week' | 'month' | 'all'
const VIEWS: { value: View; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All time' },
]

type Period = {
  title: string
  note: string | null
  matches: Match[]
  rows: Row[]
  winner: Row | null
  chenda: Row | null
  isCurrent: boolean
  prev: string | null
  next: string | null
}

export default function Table() {
  const { league, error, refetch } = useLeague()
  const [params, setParams] = useSearchParams()
  const now = useNow()
  const viewParam = params.get('view')
  const view: View = viewParam === 'month' || viewParam === 'all' ? viewParam : 'week'
  const at = params.get('at')

  const period = useMemo<Period | null>(() => {
    if (!league) return null
    const { settings, tz, nameOf } = league
    const counted = league.matches.filter(isCounted)
    const earliest = counted.reduce<string | null>(
      (min, m) => (min === null || Date.parse(m.played_at) < Date.parse(min) ? m.played_at : min),
      null,
    )

    if (view === 'week') {
      const current = weekKey(now, tz)
      const key = at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? weekKey(startOfDay(at, tz), tz) : current
      const first = earliest ? weekKey(earliest, tz) : current
      const matches = counted.filter((m) => weekKey(m.played_at, tz) === key)
      const res = weekResult(matches, settings, key, nameOf)
      return {
        title: weekLabel(key),
        note: key === current ? 'This week · live' : key === addDays(current, -7) ? 'Last week' : null,
        matches,
        rows: res.rows,
        winner: res.winner,
        chenda: res.awards.chenda,
        isCurrent: key === current,
        prev: key > first ? addDays(key, -7) : null,
        next: key < current ? addDays(key, 7) : null,
      }
    }
    if (view === 'month') {
      const current = monthKey(now, tz)
      const key = at && /^\d{4}-\d{2}$/.test(at) ? at : current
      const first = earliest ? monthKey(earliest, tz) : current
      const matches = counted.filter((m) => monthKey(m.played_at, tz) === key)
      const res = monthResult(matches, settings, key, nameOf)
      return {
        title: monthLabel(key),
        note: key === current ? 'This month' : null,
        matches,
        rows: res.rows,
        winner: res.winner,
        chenda: null,
        isCurrent: key === current,
        prev: key > first ? addMonths(key, -1) : null,
        next: key < current ? addMonths(key, 1) : null,
      }
    }
    return {
      title: 'All time',
      note: `${counted.length} matches`,
      matches: counted,
      rows: buildTable(counted, settings, 0, nameOf),
      winner: null,
      chenda: null,
      isCurrent: true,
      prev: null,
      next: null,
    }
  }, [league, view, at, now])

  const leaders = useMemo(() => (period ? statLeaders(period.matches) : []), [period])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league || !period) return <PageSkeleton />

  const s = league.settings
  const go = (next: { view?: View; at?: string | null }) => {
    const p = new URLSearchParams()
    const v = next.view ?? view
    if (v !== 'week') p.set('view', v)
    if (next.at) p.set('at', next.at)
    setParams(p, { replace: true })
  }
  const arrow = 'grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:text-ink disabled:opacity-30'

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Table" />
      <Segmented label="Period" value={view} options={VIEWS} onChange={(v) => go({ view: v, at: null })} />

      {view !== 'all' ? (
        <div className="my-4 flex items-center justify-between gap-3">
          <button className={arrow} disabled={!period.prev} onClick={() => go({ at: period.prev })} aria-label="Previous">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="font-display text-2xl leading-tight font-bold uppercase italic">{period.title}</div>
            {period.note && <div className="text-xs text-muted">{period.note}</div>}
          </div>
          <button className={arrow} disabled={!period.next} onClick={() => go({ at: period.next })} aria-label="Next">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="my-4 text-center text-xs text-muted">{period.note}</div>
      )}

      {view === 'week' && period.winner && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/[0.07] p-3.5">
          <Avatar league={league} id={period.winner.playerId} size={36} ring="gold" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-wider text-gold uppercase">
              {period.isCurrent ? 'Leading the Player of the Week race' : 'Player of the Week'}
            </div>
            <div className="truncate font-semibold">
              {league.nameOf(period.winner.playerId)} · {formatPoints(period.winner.points)} pts
            </div>
          </div>
          <Crown className="h-6 w-6 shrink-0 text-gold" aria-hidden />
        </div>
      )}

      {view === 'month' && period.winner && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#ff8a1c]/35 bg-[#ff8a1c]/[0.08] p-3.5">
          <Avatar league={league} id={period.winner.playerId} size={36} ring="gold" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-wider text-[#ffa040] uppercase">
              {period.isCurrent ? 'Leading the Player of the Month race' : 'Player of the Month'}
            </div>
            <div className="truncate font-semibold">
              {league.nameOf(period.winner.playerId)} · {formatPoints(period.winner.points)} pts
            </div>
          </div>
          <CalendarDays className="h-6 w-6 shrink-0 text-[#ffa040]" aria-hidden />
        </div>
      )}

      {view === 'week' && period.chenda && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-ember/30 bg-ember/[0.07] p-3.5">
          <Avatar league={league} id={period.chenda.playerId} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-wider text-ember uppercase">
              {period.isCurrent ? 'On the drum this week' : 'Chenda of the week'}
            </div>
            <div className="truncate font-semibold">
              {league.nameOf(period.chenda.playerId)} · {formatPerGame(period.chenda)} pts a game
            </div>
          </div>
          <Drum className="h-6 w-6 shrink-0 text-ember" aria-hidden />
        </div>
      )}

      {period.rows.length ? (
        <StandingsTable
          league={league}
          rows={period.rows}
          crownId={view !== 'all' ? period.winner?.playerId : null}
          drumId={view === 'week' ? period.chenda?.playerId : null}
          showQualification={view !== 'all'}
          sortable
        />
      ) : (
        <EmptyState icon={ListOrdered} title="No games">
          Nobody played in this period.
        </EmptyState>
      )}

      {leaders.length > 0 ? (
        <section className="mt-6">
          <SectionTitle title="Stat leaders" />
          <StatLeaders league={league} leaders={leaders} />
          <p className="mt-2 text-xs text-muted">From results logged with the full-time screenshot.</p>
        </section>
      ) : (
        period.rows.length > 0 && (
          <p className="mt-5 text-xs text-muted">Stat leaders show up here once results are logged with the full-time screenshot.</p>
        )
      )}

      <div className="mt-5 flex gap-3 rounded-2xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <p>
          <span className="font-semibold text-ink">Points:</span> {formatPoints(s.potw_win)} per win, {formatPoints(s.potw_draw)} per
          draw, {formatPoints(s.potw_goal)} per goal, {formatPoints(s.potw_clean_sheet)} per clean sheet. Player of the Week needs at
          least {s.potw_min_matches} games in the week. Ties go to win %, goal difference, goals, then head-to-head. The chenda goes to
          whoever has the fewest points a game among players with {s.potw_min_matches}+ games, once at least three have them. Player
          of the Month goes to the most points in the month, with at least {monthMinimum(s)} games. Disputed
          results don't count until they're resolved. Tap a column to sort.
        </p>
      </div>
    </div>
  )
}
