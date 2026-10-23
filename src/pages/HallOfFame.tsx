import { BrickWall, Crown, Footprints, Trophy, Utensils } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { PlayersTabs } from '../components/PlayersTabs'
import { awardItems } from '../components/Potw'
import { EmptyState, ErrorState, PageSkeleton, PageTitle, SectionTitle } from '../components/ui'
import { useLeague, useNow } from '../lib/queries'
import { formatPoints, pastWeeks, trophyCounts } from '../lib/stats'
import { weekKey, weekLabel } from '../lib/time'

export default function HallOfFame() {
  const { league, error, refetch } = useLeague()
  const now = useNow()

  const data = useMemo(() => {
    if (!league) return null
    const { matches, settings, tz, nameOf } = league
    const weeks = pastWeeks(matches, settings, weekKey(now, tz), nameOf)
    const cabinet = [...trophyCounts(weeks).entries()]
      .filter(([, t]) => t.potw + t.goldenBoots + t.walls > 0)
      .sort(
        ([ia, a], [ib, b]) =>
          b.potw - a.potw || b.goldenBoots - a.goldenBoots || b.walls - a.walls || nameOf(ia).localeCompare(nameOf(ib)),
      )
    return { weeks, cabinet }
  }, [league, now])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league || !data) return <PageSkeleton />

  const min = league.settings.potw_min_matches

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Players" />
      <PlayersTabs />

      {data.weeks.length === 0 ? (
        <EmptyState icon={<Trophy className="h-6 w-6" />} title="No trophies yet">
          The first Player of the Week is crowned when this week ends on Sunday at midnight.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          <section>
            <SectionTitle title="Trophy cabinet" />
            <div className="card divide-y divide-line/70">
              {data.cabinet.map(([id, t], i) => (
                <Link key={id} to={`/players/${id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50">
                  <span className={`w-5 text-center text-xs font-semibold tabular-nums ${i === 0 ? 'text-gold' : 'text-muted'}`}>{i + 1}</span>
                  <Avatar league={league} id={id} size={36} ring={i === 0 && t.potw > 0 ? 'gold' : undefined} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{league.nameOf(id)}</span>
                  <span className="flex items-center gap-2.5 text-sm font-semibold tabular-nums">
                    <span className={`flex items-center gap-1 ${t.potw ? 'text-gold' : 'text-muted/50'}`} title="Player of the Week">
                      <Crown className="h-4 w-4" aria-label="Player of the Week" />
                      {t.potw}
                    </span>
                    <span className={`flex items-center gap-1 ${t.goldenBoots ? 'text-ink-2' : 'text-muted/50'}`} title="Golden Boot">
                      <Footprints className="h-4 w-4" aria-label="Golden Boot" />
                      {t.goldenBoots}
                    </span>
                    <span className={`flex items-center gap-1 ${t.walls ? 'text-ink-2' : 'text-muted/50'}`} title="The Wall">
                      <BrickWall className="h-4 w-4" aria-label="The Wall" />
                      {t.walls}
                    </span>
                    <span className={`flex items-center gap-1 ${t.spoons ? 'text-ink-2' : 'text-muted/50'}`} title="Wooden Spoon">
                      <Utensils className="h-4 w-4" aria-label="Wooden Spoon" />
                      {t.spoons}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="Week by week" />
            <div className="space-y-3">
              {data.weeks.map((w) => (
                <article key={w.weekKey} className="card p-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <Link to={`/table?at=${w.weekKey}`} className="font-semibold text-ink-2 hover:text-ink">
                      {weekLabel(w.weekKey)}
                    </Link>
                    <span>
                      {w.matches.length} match{w.matches.length === 1 ? '' : 'es'}
                    </span>
                  </div>
                  {w.winner ? (
                    <Link to={`/players/${w.winner.playerId}`} className="mt-3 flex items-center gap-3">
                      <Avatar league={league} id={w.winner.playerId} size={44} ring="gold" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-display text-2xl leading-none font-bold uppercase">
                            {league.nameOf(w.winner.playerId)}
                          </span>
                          <Crown className="h-4 w-4 shrink-0 text-gold" aria-label="Player of the Week" />
                        </div>
                        <div className="mt-1 text-xs text-ink-2">
                          {w.winner.won}W {w.winner.drawn}D {w.winner.lost}L · {w.winner.gf} goals · {formatPoints(w.winner.points)} pts
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No winner: nobody played {min} games.</p>
                  )}
                  <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-line/70 pt-3 text-xs sm:grid-cols-2">
                    {awardItems(league, w.awards)
                      .filter((a) => a.ids.length > 0)
                      .map((a) => (
                        <li key={a.label} className="flex min-w-0 items-center gap-2 text-ink-2">
                          <a.icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          <span className="shrink-0 text-muted">{a.label}</span>
                          <span className="truncate font-semibold text-ink">{a.ids.map(league.nameOf).join(' & ')}</span>
                          <span className="shrink-0 text-muted">{a.detail}</span>
                        </li>
                      ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
