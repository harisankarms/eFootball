import { Crown, Plus, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Badge, EmptyState, ErrorState, PageSkeleton, PageTitle, SectionTitle, buttonClass } from '../components/ui'
import { useLeague, useTournaments, type League } from '../lib/queries'
import { formatSummary, gamesInTotal, gamesPlayed, phaseLabel, tournamentState, type TournamentState } from '../lib/tournaments'
import type { Tournament } from '../lib/types'

function TournamentCard({ league, t, s }: { league: League; t: Tournament; s: TournamentState }) {
  const total = gamesInTotal(t, t.players.length)
  const played = gamesPlayed(s)
  return (
    <Link to={`/tournaments/${t.id}`} className="card card-hover block p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-2xl leading-tight font-bold uppercase italic">{t.name}</div>
          <div className="mt-0.5 text-xs text-muted">
            {t.players.length} players · {formatSummary(t)}
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap">
          <Badge tone={s.phase === 'finished' ? 'gold' : 'accent'}>{phaseLabel(s.phase)}</Badge>
        </span>
      </div>
      {s.champion ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3 py-2">
          <Crown className="h-4 w-4 shrink-0 text-gold" aria-hidden />
          <Avatar league={league} id={s.champion} size={24} ring="gold" />
          <span className="truncate font-semibold">{league.nameOf(s.champion)}</span>
          <span className="ml-auto shrink-0 text-xs text-gold">Champion</span>
        </div>
      ) : (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (played / total) * 100)}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-muted">
            {played} of {total} games played
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {t.players.slice(0, 8).map((id) => (
            <Avatar key={id} league={league} id={id} size={26} className="ring-2 ring-surface" />
          ))}
          {t.players.length > 8 && (
            <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-surface-3 text-[10px] font-semibold ring-2 ring-surface">
              +{t.players.length - 8}
            </span>
          )}
        </div>
        {!t.counts_in_stats && <span className="text-[11px] text-muted">Not in the main stats</span>}
      </div>
    </Link>
  )
}

export default function Tournaments() {
  const { league, error, refetch } = useLeague()
  const tournaments = useTournaments()

  const items = useMemo(
    () => (league && tournaments.data ? tournaments.data.map((t) => ({ t, s: tournamentState(t, league.matches) })) : null),
    [league, tournaments.data],
  )

  if (error || tournaments.error) return <ErrorState error={error ?? tournaments.error} onRetry={refetch} />
  if (!league || !items) return <PageSkeleton />

  const active = items.filter((x) => x.s.phase !== 'finished')
  const finished = items.filter((x) => x.s.phase === 'finished')

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Tournaments"
        subtitle="Round robins, knockouts and finals for the squad."
        action={
          <Link to="/tournaments/new" className={buttonClass('primary', 'sm')}>
            <Plus className="h-4 w-4" aria-hidden strokeWidth={2.75} /> New
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Trophy} title="No tournaments yet">
          <p>Pick the players and the format: a round-robin league, then semi-finals and a final, or just the league.</p>
          <Link to="/tournaments/new" className={buttonClass('primary', 'md', 'mt-5')}>
            <Plus className="h-4 w-4" aria-hidden strokeWidth={2.75} /> Start a tournament
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-7">
          {active.length > 0 && (
            <section>
              <SectionTitle title="In progress" />
              <div className="grid gap-3 md:grid-cols-2">
                {active.map(({ t, s }) => (
                  <TournamentCard key={t.id} league={league} t={t} s={s} />
                ))}
              </div>
            </section>
          )}
          {finished.length > 0 && (
            <section>
              <SectionTitle title="Finished" />
              <div className="grid gap-3 md:grid-cols-2">
                {finished.map(({ t, s }) => (
                  <TournamentCard key={t.id} league={league} t={t} s={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
