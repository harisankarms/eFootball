import { ArrowLeftRight, Swords } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { MatchCard } from '../components/MatchCard'
import { PlayersTabs } from '../components/PlayersTabs'
import { EmptyState, ErrorState, PageSkeleton, PageTitle } from '../components/ui'
import { useAuth, useLeague, type League } from '../lib/queries'
import { headToHead, involves, isCounted, playerSummary, sideOf } from '../lib/stats'
import type { Match } from '../lib/types'

const DRAW_COLOR = '#5d6a85'

function scoreFor(m: Match | null, id: string) {
  if (!m) return '–'
  const { gf, ga } = sideOf(m, id)
  return `${gf}–${ga}`
}

function PlayerSelect({ league, value, onChange, label }: { league: League; value: string; onChange: (id: string) => void; label: string }) {
  const options = league.players.filter((p) => p.active || league.matches.some((m) => involves(m, p.id)))
  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select className="field truncate font-semibold" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function HeadToHeadPage() {
  const { league, error, refetch } = useLeague()
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()

  const [a, b] = useMemo(() => {
    if (!league || league.players.length < 2) return ['', '']
    const valid = (id: string | null) => (id && league.byId.has(id) ? id : null)
    const first = valid(params.get('a')) ?? (me && league.byId.has(me.id) ? me.id : league.players[0].id)
    const rival = playerSummary(league.matches, first).opponents[0]?.opponentId
    const second = valid(params.get('b')) ?? rival ?? league.players.find((p) => p.id !== first)!.id
    return [first, second]
  }, [league, params, me])

  const h = useMemo(() => (league && a && b ? headToHead(league.matches.filter(isCounted), a, b) : null), [league, a, b])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league) return <PageSkeleton />

  const set = (next: { a?: string; b?: string }) => setParams({ a: next.a ?? a, b: next.b ?? b }, { replace: true })

  if (league.players.length < 2 || !h) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Players" />
        <PlayersTabs />
        <EmptyState icon={<Swords className="h-6 w-6" />} title="Not enough players">
          Head-to-head needs at least two players.
        </EmptyState>
      </div>
    )
  }

  const total = h.aWins + h.draws + h.bWins
  const segments = [
    { n: h.aWins, color: league.colorOf(a), label: `${league.nameOf(a)} wins` },
    { n: h.draws, color: DRAW_COLOR, label: 'Draws' },
    { n: h.bWins, color: league.colorOf(b), label: `${league.nameOf(b)} wins` },
  ]
  const compare = [
    { label: 'Goals', a: h.aGoals, b: h.bGoals },
    { label: 'Clean sheets', a: h.aCleanSheets, b: h.bCleanSheets },
    { label: 'Penalty shootout wins', a: h.aPensWins, b: h.bPensWins },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Players" />
      <PlayersTabs />

      <div className="mb-4 flex items-center gap-2">
        <PlayerSelect league={league} value={a} onChange={(id) => set({ a: id })} label="First player" />
        <button
          onClick={() => set({ a: b, b: a })}
          aria-label="Swap players"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-2 hover:text-ink"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <PlayerSelect league={league} value={b} onChange={(id) => set({ b: id })} label="Second player" />
      </div>

      {a === b ? (
        <EmptyState icon={<Swords className="h-6 w-6" />} title="Same player twice">
          Pick two different players.
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState icon={<Swords className="h-6 w-6" />} title="No meetings yet">
          {league.nameOf(a)} and {league.nameOf(b)} haven't played each other yet.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <section className="card p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              {[a, b].map((id, i) => (
                <Link
                  key={id}
                  to={`/players/${id}`}
                  className={`flex min-w-0 flex-col items-center gap-2 text-center ${i === 1 ? 'order-3' : ''}`}
                >
                  <Avatar league={league} id={id} size={60} />
                  <span className="w-full truncate font-display text-xl leading-tight font-bold uppercase">{league.nameOf(id)}</span>
                </Link>
              ))}
              <div className="order-2 text-center">
                <div className="text-5xl leading-none font-bold tracking-tight tabular-nums">
                  {h.aWins}
                  <span className="mx-1.5 text-muted">–</span>
                  {h.bWins}
                </div>
                <div className="mt-2 text-xs text-muted">
                  {h.draws} draw{h.draws === 1 ? '' : 's'} · {total} games
                </div>
              </div>
            </div>

            <div className="mt-5 flex h-3 gap-0.5" role="img" aria-label={segments.map((s) => `${s.label}: ${s.n}`).join(', ')}>
              {segments
                .filter((s) => s.n > 0)
                .map((s) => (
                  <div key={s.label} className="rounded-[4px]" style={{ flexGrow: s.n, background: s.color }} />
                ))}
            </div>
            <div className="mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-ink-2">
              {segments.map((s) => (
                <span key={s.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.label} <span className="font-semibold text-ink tabular-nums">{s.n}</span>
                </span>
              ))}
            </div>

            <dl className="mt-5 divide-y divide-line/70 border-t border-line/70">
              {compare.map((row) => (
                <div key={row.label} className="grid grid-cols-[3rem_1fr_3rem] items-center py-2.5 text-sm">
                  <dd className={`tabular-nums ${row.a > row.b ? 'font-bold text-ink' : 'text-ink-2'}`}>{row.a}</dd>
                  <dt className="text-center text-xs text-muted">{row.label}</dt>
                  <dd className={`text-right tabular-nums ${row.b > row.a ? 'font-bold text-ink' : 'text-ink-2'}`}>{row.b}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[3rem_1fr_3rem] items-center py-2.5 text-sm">
                <dd className="text-ink-2 tabular-nums">{scoreFor(h.aBiggestWin, a)}</dd>
                <dt className="text-center text-xs text-muted">Biggest win</dt>
                <dd className="text-right text-ink-2 tabular-nums">{scoreFor(h.bBiggestWin, b)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-muted uppercase">All meetings</h2>
            <div className="grid gap-2.5 md:grid-cols-2">
              {h.matches.map((m) => (
                <MatchCard key={m.id} match={m} league={league} showDate />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
