import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, Crown, Footprints, Pencil, Plus, SearchX, Shield, Target, Trash } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { MatchCard } from '../components/MatchCard'
import { StatLeaders } from '../components/StatLeaders'
import { useToast } from '../components/Toast'
import { BackButton, Badge, Button, EmptyState, ErrorState, PageSkeleton, SectionTitle, Sheet, StatTile, buttonClass } from '../components/ui'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { statLeaders } from '../lib/matchStats'
import { keys, useAuth, useLeague, useTournaments, type League } from '../lib/queries'
import { signed, sideOf } from '../lib/stats'
import { longDate } from '../lib/time'
import {
  STAGE_LABELS,
  formatSummary,
  gamesInTotal,
  gamesPlayed,
  phaseLabel,
  tournamentState,
  tournamentStats,
  type Fixture,
  type OpenGame,
  type Tie,
} from '../lib/tournaments'
import type { Tournament } from '../lib/types'

const logLink = (t: Tournament, g: OpenGame) => `/add?tournament=${t.id}&stage=${g.stage}&home=${g.home}&away=${g.away}`

function Versus({ league, a, b }: { league: League; a: string; b: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
      <Avatar league={league} id={a} size={22} />
      <span className="truncate">{league.nameOf(a)}</span>
      <span className="shrink-0 text-xs font-normal text-muted">vs</span>
      <Avatar league={league} id={b} size={22} />
      <span className="truncate">{league.nameOf(b)}</span>
    </span>
  )
}

function TieCard({ league, t, tie }: { league: League; t: Tournament; tie: Tie }) {
  const sides = [
    { id: tie.a, from: tie.aFrom },
    { id: tie.b, from: tie.bFrom },
  ]
  return (
    <div className={`card p-3 ${tie.stage === 'final' ? 'border-gold/40' : ''}`}>
      {sides.map((s, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          {s.id ? (
            <Avatar league={league} id={s.id} size={24} ring={tie.winner === s.id && tie.stage === 'final' ? 'gold' : undefined} />
          ) : (
            <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-line-strong" aria-hidden />
          )}
          <span className={`truncate text-sm ${!s.id ? 'text-muted' : tie.winner === s.id ? 'font-bold text-ink' : tie.winner ? 'text-ink-2' : 'text-ink'}`}>
            {s.id ? league.nameOf(s.id) : s.from}
          </span>
          {s.id && tie.match?.pens_winner_id === s.id && <Badge tone="gold">Pens</Badge>}
          <span className="ml-auto text-lg leading-none font-bold tabular-nums">{s.id && tie.match ? sideOf(tie.match, s.id).gf : ''}</span>
        </div>
      ))}
      <div className="mt-1.5 border-t border-line/70 pt-2 text-xs">
        {tie.match ? (
          <Link to={`/match/${tie.match.id}`} className="text-muted hover:text-ink">
            Match details
          </Link>
        ) : tie.a && tie.b ? (
          <Link to={logLink(t, { stage: tie.stage, home: tie.a, away: tie.b })} className="font-semibold text-accent hover:underline">
            Log the result
          </Link>
        ) : (
          <span className="text-muted">Decided by {tie.aFrom.startsWith('Winner') ? 'the round before' : 'the league table'}</span>
        )}
      </div>
    </div>
  )
}

function FixtureRow({ league, t, f }: { league: League; t: Tournament; f: Fixture }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
        <span className="truncate">{league.nameOf(f.home)}</span>
        <Avatar league={league} id={f.home} size={22} />
      </span>
      <span className={`w-14 shrink-0 text-center tabular-nums ${f.match ? 'font-bold' : 'text-xs text-muted'}`}>
        {f.match ? `${sideOf(f.match, f.home).gf}–${sideOf(f.match, f.away).gf}` : 'vs'}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Avatar league={league} id={f.away} size={22} />
        <span className="truncate">{league.nameOf(f.away)}</span>
      </span>
    </>
  )
  const cls = 'flex items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-surface-2/50'
  return f.match ? (
    <Link to={`/match/${f.match.id}`} className={cls}>
      {body}
    </Link>
  ) : (
    <Link to={logLink(t, { stage: 'league', home: f.home, away: f.away })} className={cls} aria-label={`Log ${league.nameOf(f.home)} vs ${league.nameOf(f.away)}`}>
      {body}
    </Link>
  )
}

export default function TournamentPage() {
  const { id } = useParams()
  const { league, error, refetch } = useLeague()
  const tournaments = useTournaments()
  const { me, isAdmin } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'rename' | 'delete' | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const t = tournaments.data?.find((x) => x.id === id)
  const data = useMemo(() => {
    if (!t || !league) return null
    const state = tournamentState(t, league.matches)
    return { state, stats: tournamentStats(t, state), leaders: statLeaders(state.matches, (m) => m.status === 'ok') }
  }, [t, league])

  if (error || tournaments.error) return <ErrorState error={error ?? tournaments.error} onRetry={refetch} />
  if (!league || !tournaments.data) return <PageSkeleton />
  if (!t || !data) {
    return (
      <EmptyState icon={SearchX} title="Tournament not found">
        <Link to="/tournaments" className={buttonClass('secondary', 'md', 'mt-4')}>
          All tournaments
        </Link>
      </EmptyState>
    )
  }

  const { state, stats, leaders } = data
  const total = gamesInTotal(t, t.players.length)
  const played = gamesPlayed(state)
  const canManage = isAdmin || (!!me && t.created_by === me.id)
  const hasResults = league.matches.some((m) => m.tournament_id === t.id)
  const qualify = t.knockout_size
  const matchdays: [number, Fixture[]][] = []
  for (const f of state.fixtures) {
    const day = matchdays.at(-1)
    if (day && day[0] === f.round) day[1].push(f)
    else matchdays.push([f.round, [f]])
  }
  const topScorer = stats.topScorers[0]
  const bestDefence = stats.cleanSheets[0]

  async function run(action: () => Promise<void>, message: string, after?: () => void) {
    setBusy(true)
    try {
      await action()
      await qc.invalidateQueries({ queryKey: keys.tournaments })
      toast.success(message)
      setSheet(null)
      after?.()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton fallback="/tournaments" />

      <section className="card relative overflow-hidden p-5">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgb(255_207_77/0.16),transparent_70%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={state.phase === 'finished' ? 'gold' : 'accent'}>{phaseLabel(state.phase)}</Badge>
            {!t.counts_in_stats && <Badge>Not in the main stats</Badge>}
          </div>
          <h1 className="mt-2 font-display text-[2.4rem] leading-none font-bold break-words uppercase italic">{t.name}</h1>
          <p className="mt-2 text-sm text-ink-2">
            {t.players.length} players · {formatSummary(t)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Started {longDate(t.created_at, league.tz)}
            {t.created_by ? ` by ${league.nameOf(t.created_by)}` : ''}
          </p>
          {state.champion ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gold/35 bg-gold/[0.08] p-3.5">
              <Avatar league={league} id={state.champion} size={52} ring="gold" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold tracking-wider text-gold uppercase">Champion</div>
                <div className="truncate font-display text-3xl leading-tight font-bold uppercase italic">{league.nameOf(state.champion)}</div>
              </div>
              <Crown className="h-8 w-8 shrink-0 text-gold drop-shadow-[0_0_12px_rgb(255_207_77/0.6)]" aria-hidden />
            </div>
          ) : (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#3dff8f,#22d3ee)]" style={{ width: `${Math.min(100, (played / total) * 100)}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-muted">
                {played} of {total} games played
              </div>
            </div>
          )}
        </div>
      </section>

      {state.open.length > 0 && (
        <section>
          <SectionTitle title="Up next" />
          <div className="card divide-y divide-line/70">
            {state.open.slice(0, 6).map((g, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{STAGE_LABELS[g.stage]}</div>
                  <div className="mt-1">
                    <Versus league={league} a={g.home} b={g.away} />
                  </div>
                </div>
                <Link to={logLink(t, g)} className={buttonClass('secondary', 'sm', 'shrink-0')}>
                  <Plus className="h-4 w-4" aria-hidden /> Log
                </Link>
              </div>
            ))}
          </div>
          {state.open.length > 6 && <p className="mt-2 text-xs text-muted">And {state.open.length - 6} more in the fixtures below.</p>}
        </section>
      )}

      <section>
        <SectionTitle title={qualify ? 'League stage' : 'Table'} />
        <div className="card overflow-hidden">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] tracking-wider text-muted uppercase">
                <th className="py-2.5 pl-4 text-left font-semibold">#</th>
                <th className="text-left font-semibold">Player</th>
                <th className="w-8 font-semibold">P</th>
                <th className="w-8 font-semibold">W</th>
                <th className="w-8 font-semibold">D</th>
                <th className="w-8 font-semibold">L</th>
                <th className="w-10 font-semibold">GD</th>
                <th className="w-12 pr-4 text-right font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {state.table.map((r, i) => (
                <tr key={r.playerId} className={`border-t border-line/70 ${i < qualify ? 'shadow-[inset_3px_0_0_rgb(61_255_143/0.7)]' : ''}`}>
                  <td className="py-2.5 pl-4 text-muted">{i + 1}</td>
                  <td className="max-w-0">
                    <Link to={`/players/${r.playerId}`} className="flex min-w-0 items-center gap-2">
                      <Avatar league={league} id={r.playerId} size={24} />
                      <span className="truncate font-semibold">{league.nameOf(r.playerId)}</span>
                    </Link>
                  </td>
                  <td className="text-center">{r.played}</td>
                  <td className="text-center">{r.won}</td>
                  <td className="text-center">{r.drawn}</td>
                  <td className="text-center">{r.lost}</td>
                  <td className="text-center text-ink-2">{signed(r.gd)}</td>
                  <td className="pr-4 text-right font-bold">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          3 points for a win, 1 for a draw.{' '}
          {qualify
            ? `The top ${qualify} go through to the ${qualify === 2 ? 'final' : qualify === 4 ? 'semi-finals' : 'quarter-finals'}.`
            : 'Top of the table wins.'}
        </p>
      </section>

      {state.rounds.length > 0 && (
        <section>
          <SectionTitle title="Knockouts" />
          <div className={`grid gap-4 ${state.rounds.length === 3 ? 'md:grid-cols-3' : state.rounds.length === 2 ? 'md:grid-cols-2' : ''}`}>
            {state.rounds.map((round) => (
              <div key={round.stage}>
                <div className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">{round.label}</div>
                <div className="space-y-2.5">
                  {round.ties.map((tie, i) => (
                    <TieCard key={i} league={league} t={t} tie={tie} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <details open={!state.leagueDone} className="group">
          <summary className="mb-3 flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="font-display text-xl font-bold tracking-wider uppercase italic">League fixtures</span>
            <span className="flex items-center gap-1 text-xs text-muted">
              {state.fixtures.filter((f) => f.match).length} of {state.fixtures.length} played
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <div className="space-y-4">
            {matchdays.map(([round, list]) => (
              <div key={round}>
                <div className="mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">Matchday {round}</div>
                <div className="card divide-y divide-line/70">
                  {list.map((f, i) => (
                    <FixtureRow key={i} league={league} t={t} f={f} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>

      {stats.played > 0 && (
        <section>
          <SectionTitle title="Tournament stats" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Games played" value={stats.played} sub={`of ${total}`} icon={CalendarDays} tint="cyan" />
            <StatTile label="Goals" value={stats.goals} sub={`${(stats.goals / stats.played).toFixed(1)} a game`} icon={Target} tint="gold" />
            <StatTile
              label="Top scorer"
              value={topScorer ? league.nameOf(topScorer.playerId) : '–'}
              sub={topScorer ? `${topScorer.goals} goal${topScorer.goals === 1 ? '' : 's'}` : undefined}
              icon={Footprints}
              tint="violet"
            />
            <StatTile
              label="Clean sheets"
              value={bestDefence ? league.nameOf(bestDefence.playerId) : '–'}
              sub={bestDefence ? `${bestDefence.count} clean sheet${bestDefence.count === 1 ? '' : 's'}` : undefined}
              icon={Shield}
            />
          </div>
          {stats.biggestWin && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-muted">Biggest win</div>
              <MatchCard match={stats.biggestWin} league={league} showDate />
            </div>
          )}
          {leaders.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-muted">Stat leaders, from screenshots</div>
              <StatLeaders league={league} leaders={leaders} />
            </div>
          )}
        </section>
      )}

      {state.matches.length > 0 && (
        <section>
          <SectionTitle title={`Results · ${state.matches.length}`} />
          <div className="grid gap-2.5 md:grid-cols-2">
            {state.matches.map((m) => (
              <MatchCard key={m.id} match={m} league={league} showDate />
            ))}
          </div>
        </section>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Pencil className="h-4 w-4" />}
            onClick={() => {
              setName(t.name)
              setSheet('rename')
            }}
          >
            Rename
          </Button>
          {!hasResults && (
            <Button variant="ghost" icon={<Trash className="h-4 w-4" />} onClick={() => setSheet('delete')}>
              Delete
            </Button>
          )}
        </div>
      )}

      <Sheet open={sheet === 'rename'} onClose={() => setSheet(null)} title="Rename tournament">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => api.renameTournament(t.id, name), 'Tournament renamed')
          }}
        >
          <input className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet(null)} title="Delete tournament">
        <p className="text-sm text-ink-2">Delete {t.name}? It has no results yet, so nothing else changes.</p>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={() => setSheet(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={busy}
            onClick={() => void run(() => api.deleteTournament(t.id), 'Tournament deleted', () => navigate('/tournaments', { replace: true }))}
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
