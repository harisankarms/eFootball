import { ArrowLeftRight, CalendarDays, ChevronDown, Flame, Plus, Swords, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { FormChips } from '../components/FormChips'
import { MatchCard } from '../components/MatchCard'
import { PlayerPickerSheet } from '../components/PlayerPickerSheet'
import { Button, EmptyState, ErrorState, PageSkeleton, PageTitle, SectionTitle, buttonClass } from '../components/ui'
import { useAuth, useLeague, type League } from '../lib/queries'
import { headToHead, playerSummary, rivalries, sideOf, type HeadToHead } from '../lib/stats'
import { longDate } from '../lib/time'
import type { Match } from '../lib/types'

const DRAW_COLOR = '#5d6a85'

function scoreFor(m: Match | null, id: string) {
  if (!m) return '–'
  const { gf, ga } = sideOf(m, id)
  return `${gf}–${ga}`
}

function MatchupCard({ league, id, onClick, label }: { league: League; id: string; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${league.nameOf(id)}. Tap to change`}
      className="card card-hover flex min-w-0 flex-col items-center gap-2 overflow-hidden px-3 pt-5 pb-4"
      style={{ boxShadow: `inset 0 -3px 0 ${league.colorOf(id)}` }}
    >
      <Avatar league={league} id={id} size={64} />
      <span className="w-full truncate font-display text-2xl leading-tight font-bold uppercase italic">{league.nameOf(id)}</span>
      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
        Change <ChevronDown className="h-3 w-3" aria-hidden />
      </span>
    </button>
  )
}

/** Two bars growing outwards from the middle, each the player's share of the total. */
function CompareRow({
  label,
  a,
  b,
  colorA,
  colorB,
  format = (n: number) => String(n),
}: {
  label: string
  a: number
  b: number
  colorA: string
  colorB: string
  format?: (n: number) => string
}) {
  const total = a + b
  const shareA = total ? (a / total) * 100 : 0
  const shareB = total ? (b / total) * 100 : 0
  return (
    <div className="py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm tabular-nums">
        <span className={a > b ? 'font-bold text-ink' : 'text-ink-2'}>{format(a)}</span>
        <span className="text-center text-xs text-muted">{label}</span>
        <span className={b > a ? 'font-bold text-ink' : 'text-ink-2'}>{format(b)}</span>
      </div>
      <div className="flex h-2 gap-0.5" aria-hidden>
        <div className="flex flex-1 justify-end rounded-l-full bg-white/[0.05]">
          <div className="h-full origin-right animate-grow-x rounded-[4px]" style={{ width: `${shareA}%`, background: colorA }} />
        </div>
        <div className="flex flex-1 rounded-r-full bg-white/[0.05]">
          <div className="h-full origin-left animate-grow-x rounded-[4px]" style={{ width: `${shareB}%`, background: colorB }} />
        </div>
      </div>
    </div>
  )
}

function streakText(h: HeadToHead, nameA: string, nameB: string) {
  if (!h.streak) return null
  const { side, count } = h.streak
  if (side === 'draw') return count === 1 ? 'The last meeting was a draw' : `The last ${count} meetings were draws`
  const who = side === 'a' ? nameA : nameB
  return count === 1 ? `${who} won the last meeting` : `${who} has won the last ${count} in a row`
}

export default function HeadToHeadPage() {
  const { league, error, refetch } = useLeague()
  const { me, isMember, session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [picking, setPicking] = useState<'a' | 'b' | null>(null)
  const [shown, setShown] = useState(5)

  const rivals = useMemo(() => (league ? rivalries(league.matches) : []), [league])

  const [a, b] = useMemo(() => {
    if (!league || league.players.length < 2) return ['', '']
    const valid = (id: string | null) => (id && league.byId.has(id) ? id : null)
    const pa = valid(params.get('a'))
    const pb = valid(params.get('b'))
    if (pa && pb) return [pa, pb]
    const mine = me && league.byId.has(me.id) ? me.id : null
    const first = pa ?? mine ?? rivals[0]?.a ?? league.players[0].id
    const rival = playerSummary(league.matches, first).opponents[0]?.opponentId
    const second = pb ?? (rival && rival !== first ? rival : null) ?? league.players.find((p) => p.id !== first)!.id
    return [first, second]
  }, [league, params, me, rivals])

  const h = useMemo(() => (league && a && b && a !== b ? headToHead(league.matches, a, b) : null), [league, a, b])

  useEffect(() => setShown(5), [a, b])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league) return <PageSkeleton />

  const title = <PageTitle title="Head to Head" subtitle="Every meeting between two players, and who comes out on top." />

  if (league.players.length < 2) {
    return (
      <div className="mx-auto max-w-3xl">
        {title}
        <EmptyState icon={UserPlus} title="Needs two players">
          Head to Head appears once a second player joins. Share the site link with your squad.
        </EmptyState>
      </div>
    )
  }

  const select = (na: string, nb: string) => setParams({ a: na, b: nb }, { replace: true })
  const nameA = league.nameOf(a)
  const nameB = league.nameOf(b)
  const colorA = league.colorOf(a)
  const colorB = league.colorOf(b)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {title}

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <MatchupCard league={league} id={a} onClick={() => setPicking('a')} label="First player" />
        <div className="flex flex-col items-center gap-2">
          <span className="grid h-13 w-13 place-items-center rounded-full border border-line-strong bg-surface shadow-[0_0_28px_-6px_rgb(139_92_246/0.7)]">
            <span className="font-display text-xl font-bold italic text-gradient">VS</span>
          </span>
          <button
            onClick={() => select(b, a)}
            aria-label="Swap players"
            className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-white/[0.06] hover:text-ink"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>
        <MatchupCard league={league} id={b} onClick={() => setPicking('b')} label="Second player" />
      </div>

      {a === b || !h ? (
        <EmptyState icon={Swords} title="Same player twice">
          Pick two different players.
        </EmptyState>
      ) : h.played === 0 ? (
        <EmptyState icon={Swords} title="No meetings yet">
          <p>
            {nameA} and {nameB} haven't played each other yet.
          </p>
          {(isMember || !session) && (
            <Link to="/add" className={buttonClass('primary', 'md', 'mt-5')}>
              <Plus className="h-4 w-4" aria-hidden strokeWidth={2.75} /> Log a result
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <section className="card overflow-hidden p-5">
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-2/3" style={{ background: `radial-gradient(70% 80% at 0% 40%, ${colorA}40, transparent 70%)` }} />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-2/3" style={{ background: `radial-gradient(70% 80% at 100% 40%, ${colorB}40, transparent 70%)` }} />
            <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
              {[
                { id: a, wins: h.aWins, name: nameA },
                { id: b, wins: h.bWins, name: nameB },
              ].map((side, i) => (
                <div key={side.id} className={i === 1 ? 'order-3' : ''}>
                  <div className="text-6xl leading-none font-bold tracking-tight tabular-nums">{side.wins}</div>
                  <div className="mt-2 truncate text-[11px] font-semibold tracking-wider text-muted uppercase">{side.name} wins</div>
                  <div className="mt-0.5 text-sm font-semibold text-ink-2">{Math.round((side.wins / h.played) * 100)}%</div>
                </div>
              ))}
              <div className="order-2 px-2">
                <div className="text-sm font-semibold text-ink-2">{h.draws}</div>
                <div className="text-[11px] text-muted">draw{h.draws === 1 ? '' : 's'}</div>
                <div className="mt-2 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-ink-2">{h.played} played</div>
              </div>
            </div>

            <div
              className="relative mt-5 flex h-3 gap-0.5"
              role="img"
              aria-label={`${nameA} won ${h.aWins}, ${h.draws} draws, ${nameB} won ${h.bWins}`}
            >
              {[
                { n: h.aWins, color: colorA, key: 'a' },
                { n: h.draws, color: DRAW_COLOR, key: 'd' },
                { n: h.bWins, color: colorB, key: 'b' },
              ]
                .filter((s) => s.n > 0)
                .map((s) => (
                  <div key={s.key} className="rounded-[4px] shadow-[0_0_14px_-4px_currentColor]" style={{ flexGrow: s.n, background: s.color, color: s.color }} />
                ))}
            </div>
            <div className="relative mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} aria-hidden />
                {nameA}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: DRAW_COLOR }} aria-hidden />
                Draws
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} aria-hidden />
                {nameB}
              </span>
            </div>

            <div className="relative mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
              {streakText(h, nameA, nameB) && (
                <p className="flex items-center gap-2 font-semibold">
                  <Flame className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                  {streakText(h, nameA, nameB)}
                </p>
              )}
              {h.firstMeeting && (
                <p className="flex items-center gap-2 text-ink-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  First met {longDate(h.firstMeeting.played_at, league.tz)} · last met {longDate(h.matches[0].played_at, league.tz)}
                </p>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorA }} aria-hidden />
                <span className="truncate">{nameA}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{nameB}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorB }} aria-hidden />
              </span>
            </div>
            <div className="mt-1 divide-y divide-white/[0.06]">
              <CompareRow label="Wins" a={h.aWins} b={h.bWins} colorA={colorA} colorB={colorB} />
              <CompareRow label="Goals" a={h.aGoals} b={h.bGoals} colorA={colorA} colorB={colorB} />
              <CompareRow
                label="Goals per game"
                a={h.aGoals / h.played}
                b={h.bGoals / h.played}
                colorA={colorA}
                colorB={colorB}
                format={(n) => n.toFixed(1)}
              />
              <CompareRow label="Clean sheets" a={h.aCleanSheets} b={h.bCleanSheets} colorA={colorA} colorB={colorB} />
              <CompareRow label="Longest winning run" a={h.aLongestWinStreak} b={h.bLongestWinStreak} colorA={colorA} colorB={colorB} />
              <CompareRow label="Penalty shootout wins" a={h.aPensWins} b={h.bPensWins} colorA={colorA} colorB={colorB} />
              <div className="flex items-baseline justify-between gap-3 py-3 text-sm tabular-nums">
                <span className="text-ink-2">{scoreFor(h.aBiggestWin, a)}</span>
                <span className="text-xs text-muted">Biggest win</span>
                <span className="text-ink-2">{scoreFor(h.bBiggestWin, b)}</span>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-2 text-xs font-medium text-muted">Last {h.aForm.length} meetings, oldest to newest</div>
            {[
              { id: a, form: h.aForm },
              { id: b, form: h.bForm },
            ].map((row) => (
              <div key={row.id} className="flex items-center gap-3 py-2">
                <Avatar league={league} id={row.id} size={30} />
                <span className="min-w-0 flex-1 truncate font-semibold">{league.nameOf(row.id)}</span>
                <FormChips form={row.form} size="md" />
              </div>
            ))}
          </section>

          {h.highestScoring && (
            <section>
              <SectionTitle title="Highest-scoring game" />
              <MatchCard match={h.highestScoring} league={league} showDate />
            </section>
          )}

          <section>
            <SectionTitle title={`All results · ${h.played}`} />
            <div className="grid gap-2.5 md:grid-cols-2">
              {h.matches.slice(0, shown).map((m) => (
                <MatchCard key={m.id} match={m} league={league} showDate />
              ))}
            </div>
            {h.played > shown && (
              <Button className="mt-3 w-full" onClick={() => setShown((n) => n + 10)}>
                Show more ({h.played - shown} left)
              </Button>
            )}
          </section>
        </>
      )}

      {rivals.length > 0 && (
        <section>
          <SectionTitle title="All rivalries" />
          <div className="card divide-y divide-white/[0.06] overflow-hidden">
            {rivals.map((r) => {
              const active = (r.a === a && r.b === b) || (r.a === b && r.b === a)
              return (
                <button
                  key={`${r.a}-${r.b}`}
                  onClick={() => {
                    select(r.a, r.b)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] ${
                    active ? 'bg-accent/[0.07]' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar league={league} id={r.a} size={28} />
                    <span className="truncate font-semibold">{league.nameOf(r.a)}</span>
                  </span>
                  <span className="text-center">
                    <span className="block font-bold tabular-nums">
                      {r.aWins}–{r.bWins}
                    </span>
                    <span className="block text-[11px] whitespace-nowrap text-muted">
                      {r.played} games{r.draws ? ` · ${r.draws} D` : ''}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center justify-end gap-2">
                    <span className="truncate font-semibold text-ink-2">{league.nameOf(r.b)}</span>
                    <Avatar league={league} id={r.b} size={28} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <PlayerPickerSheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        league={league}
        title={picking === 'a' ? 'First player' : 'Second player'}
        selected={picking === 'a' ? a : b}
        exclude={picking === 'a' ? b : a}
        onPick={(id) => (picking === 'a' ? select(id, b) : select(a, id))}
      />
    </div>
  )
}
