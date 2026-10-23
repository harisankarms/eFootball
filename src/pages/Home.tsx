import { ChevronRight, Plus, Swords } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { MatchCard } from '../components/MatchCard'
import { AwardsStrip, PotwCard } from '../components/Potw'
import { StandingsTable } from '../components/StandingsTable'
import { EmptyState, ErrorState, PageSkeleton, SectionTitle, buttonClass } from '../components/ui'
import { useAuth, useLeague, useNow } from '../lib/queries'
import { groupByWeek, newestFirst, weekResult } from '../lib/stats'
import { addDays, weekKey } from '../lib/time'

function MoreLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 text-sm font-semibold text-accent hover:underline">
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}

export default function Home() {
  const { league, error, refetch } = useLeague()
  const { isMember, session } = useAuth()
  const now = useNow()

  const view = useMemo(() => {
    if (!league) return null
    const { matches, settings, tz, nameOf } = league
    const current = weekKey(now, tz)
    const previous = addDays(current, -7)
    const byWeek = groupByWeek(matches, tz)
    return {
      week: weekResult(byWeek.get(current) ?? [], settings, current, nameOf),
      lastWeek: weekResult(byWeek.get(previous) ?? [], settings, previous, nameOf),
      latest: newestFirst(matches).slice(0, 6),
    }
  }, [league, now])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league || !view) return <PageSkeleton />

  if (league.matches.length === 0) {
    return (
      <EmptyState icon={<Swords className="h-6 w-6" />} title={`Welcome to ${league.settings.group_name}`}>
        <p>No results yet. Log your first match to start the Player of the Week race.</p>
        <Link to={isMember || !session ? '/add' : '/login'} className={buttonClass('primary', 'lg', 'mt-6')}>
          <Plus className="h-5 w-5" aria-hidden /> Log the first result
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-7 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
      <div className="min-w-0 space-y-7">
        <PotwCard league={league} week={view.week} lastWeek={view.lastWeek} now={now} />
        <section>
          <SectionTitle title="This week's awards" />
          <AwardsStrip league={league} awards={view.week.awards} />
        </section>
        <section>
          <SectionTitle title="This week" action={<MoreLink to="/table">Full table</MoreLink>} />
          {view.week.rows.length ? (
            <StandingsTable
              league={league}
              rows={view.week.rows}
              crownId={view.week.winner?.playerId}
              showQualification
              compact
              limit={5}
            />
          ) : (
            <p className="card p-5 text-sm text-ink-2">Nobody has played this week yet.</p>
          )}
        </section>
      </div>
      <section className="min-w-0">
        <SectionTitle title="Latest results" action={<MoreLink to="/matches">All matches</MoreLink>} />
        <div className="space-y-2.5">
          {view.latest.map((m) => (
            <MatchCard key={m.id} match={m} league={league} showDate />
          ))}
        </div>
      </section>
    </div>
  )
}
