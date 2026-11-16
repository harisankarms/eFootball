import { BrickWall, CalendarDays, Crown, Drum, Footprints, Play, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { PlayersTabs } from '../components/PlayersTabs'
import { CollectibleCard, awardItems } from '../components/Potw'
import { EmptyState, ErrorState, PageSkeleton, PageTitle, SectionTitle } from '../components/ui'
import { useLeague, useNow } from '../lib/queries'
import { firstSeason, pastSeasons, seasonKeyOf, seasonMinimum, seasonName, seasonSpan } from '../lib/seasons'
import { formatPerGame, formatPoints, pastMonths, pastWeeks, trophyCounts } from '../lib/stats'
import { monthCardLabel, monthKey, weekKey, weekLabel } from '../lib/time'

export default function HallOfFame() {
  const { league, error, refetch } = useLeague()
  const now = useNow()

  const data = useMemo(() => {
    if (!league) return null
    const { matches, settings, tz, nameOf } = league
    const weeks = pastWeeks(matches, settings, weekKey(now, tz), nameOf)
    const allMonths = pastMonths(matches, settings, monthKey(now, tz), nameOf)
    const months = allMonths.filter((m) => m.winner)
    const first = firstSeason(matches, tz)
    const seasons = pastSeasons(matches, settings, seasonKeyOf(now, tz), weeks, allMonths, nameOf)
    const counts = trophyCounts(weeks)
    const tally = (ids: (string | undefined)[]) => {
      const out = new Map<string, number>()
      for (const id of ids) if (id) out.set(id, (out.get(id) ?? 0) + 1)
      return out
    }
    const potm = tally(months.map((m) => m.winner?.playerId))
    const titles = tally(seasons.map((s) => s.champion?.playerId))
    const none = { potw: 0, goldenBoots: 0, walls: 0, chendas: 0 }
    const cabinet = [...new Set([...counts.keys(), ...potm.keys(), ...titles.keys()])]
      .map((id) => [id, { ...(counts.get(id) ?? none), potm: potm.get(id) ?? 0, seasons: titles.get(id) ?? 0 }] as const)
      .filter(([, t]) => t.seasons + t.potm + t.potw + t.goldenBoots + t.walls + t.chendas > 0)
      .sort(
        ([ia, a], [ib, b]) =>
          b.seasons - a.seasons ||
          b.potm - a.potm ||
          b.potw - a.potw ||
          b.goldenBoots - a.goldenBoots ||
          b.walls - a.walls ||
          nameOf(ia).localeCompare(nameOf(ib)),
      )
    return { weeks, months, seasons, first, cabinet }
  }, [league, now])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league || !data) return <PageSkeleton />

  const min = league.settings.potw_min_matches

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Players" />
      <PlayersTabs />

      {data.weeks.length === 0 ? (
        <EmptyState icon={Trophy} title="No trophies yet">
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
                  <Avatar league={league} id={id} size={36} ring={i === 0 && t.potw + t.potm > 0 ? 'gold' : undefined} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{league.nameOf(id)}</span>
                  <span className="flex items-center gap-2.5 text-sm font-semibold tabular-nums">
                    {data.seasons.length > 0 && (
                      <span className={`flex items-center gap-1 ${t.seasons ? 'text-gold' : 'text-muted/50'}`} title="Season champion">
                        <Trophy className="h-4 w-4" aria-label="Season champion" />
                        {t.seasons}
                      </span>
                    )}
                    {data.months.length > 0 && (
                      <span className={`flex items-center gap-1 ${t.potm ? 'text-[#ffa040]' : 'text-muted/50'}`} title="Player of the Month">
                        <CalendarDays className="h-4 w-4" aria-label="Player of the Month" />
                        {t.potm}
                      </span>
                    )}
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
                    <span className={`flex items-center gap-1 ${t.chendas ? 'text-ember' : 'text-muted/50'}`} title="Chenda">
                      <Drum className="h-4 w-4" aria-label="Chenda" />
                      {t.chendas}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {data.seasons.length > 0 && (
            <section>
              <SectionTitle title="Seasons" />
              <div className="space-y-3">
                {data.seasons.map((s) => {
                  const crowns = [...s.crowns.entries()].sort((a, b) => b[1] - a[1])[0]
                  const honours = [
                    { icon: Footprints, label: 'Top scorer', ids: s.awards.goldenBoot?.ids ?? [], detail: s.awards.goldenBoot ? `${s.awards.goldenBoot.goals} goals` : '' },
                    { icon: BrickWall, label: 'Best defence', ids: s.awards.wall?.ids ?? [], detail: s.awards.wall ? `${s.awards.wall.cleanSheets} clean sheets` : '' },
                    { icon: Crown, label: 'Most crowns', ids: crowns ? [crowns[0]] : [], detail: crowns ? `${crowns[1]}× Player of the Week` : '' },
                    { icon: Drum, label: 'Season chenda', ids: s.awards.chenda ? [s.awards.chenda.playerId] : [], detail: s.awards.chenda ? `${formatPerGame(s.awards.chenda)} pts a game` : '' },
                  ].filter((h) => h.ids.length)
                  return (
                    <article key={s.key} className="card overflow-hidden p-4">
                      <div aria-hidden className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(255_207_77/0.16),transparent_70%)]" />
                      <div className="relative flex items-center justify-between gap-3 text-xs text-muted">
                        <Link to={`/table?view=season&at=${s.key}`} className="font-semibold text-ink-2 hover:text-ink">
                          {seasonName(s.key, data.first ?? s.key)} · {seasonSpan(s.key)}
                        </Link>
                        <span className="flex items-center gap-3">
                          {s.matches.length} matches
                          <Link to={`/?season=${s.key}`} className="flex items-center gap-1 font-semibold text-accent hover:text-cyan">
                            <Play className="h-3 w-3" fill="currentColor" aria-hidden /> Recap
                          </Link>
                        </span>
                      </div>
                      {s.champion ? (
                        <Link to={`/players/${s.champion.playerId}`} className="relative mt-3 flex items-center gap-3">
                          <Avatar league={league} id={s.champion.playerId} size={48} ring="gold" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-display text-2xl leading-none font-bold uppercase italic">{league.nameOf(s.champion.playerId)}</span>
                              <Trophy className="h-4 w-4 shrink-0 text-gold" aria-label="Season champion" />
                            </div>
                            <div className="mt-1 text-xs text-ink-2">
                              Champion · {formatPoints(s.champion.points)} pts · {s.champion.won}W {s.champion.drawn}D {s.champion.lost}L
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <p className="relative mt-3 text-sm text-muted">No champion: nobody played {seasonMinimum(league.settings)} games.</p>
                      )}
                      {honours.length > 0 && (
                        <ul className="relative mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-line/70 pt-3 text-xs sm:grid-cols-2">
                          {honours.map((h) => (
                            <li key={h.label} className="flex min-w-0 items-center gap-2 text-ink-2">
                              <h.icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                              <span className="shrink-0 text-muted">{h.label}</span>
                              <span className="truncate font-semibold text-ink">{h.ids.map(league.nameOf).join(' & ')}</span>
                              <span className="shrink-0 text-muted">{h.detail}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {data.months.length > 0 && (
            <section>
              <SectionTitle title="Player of the Month" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.months.map((m) => (
                  <CollectibleCard
                    key={m.monthKey}
                    kind="potm"
                    league={league}
                    row={m.winner}
                    month={m.monthKey}
                    caption={monthCardLabel(m.monthKey)}
                    mini
                    to={`/table?view=month&at=${m.monthKey}`}
                  />
                ))}
              </div>
            </section>
          )}

          {data.weeks.some((w) => w.winner) && (
            <section>
              <SectionTitle title="Card collection" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.weeks
                  .filter((w) => w.winner)
                  .map((w) => (
                    <CollectibleCard key={w.weekKey} league={league} row={w.winner} caption={weekLabel(w.weekKey)} mini to={`/table?at=${w.weekKey}`} />
                  ))}
              </div>
            </section>
          )}

          {data.weeks.some((w) => w.awards.chenda) && (
            <section>
              <SectionTitle title="Chenda collection" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.weeks
                  .filter((w) => w.awards.chenda)
                  .map((w) => (
                    <CollectibleCard
                      key={w.weekKey}
                      kind="chenda"
                      league={league}
                      row={w.awards.chenda}
                      caption={weekLabel(w.weekKey)}
                      mini
                      to={`/table?at=${w.weekKey}`}
                    />
                  ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle title="Week by week" />
            <div className="space-y-3">
              {data.weeks.map((w) => (
                <article key={w.weekKey} className="card p-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <Link to={`/table?at=${w.weekKey}`} className="font-semibold text-ink-2 hover:text-ink">
                      {weekLabel(w.weekKey)}
                    </Link>
                    <span className="flex items-center gap-3">
                      {w.matches.length} match{w.matches.length === 1 ? '' : 'es'}
                      <Link to={`/?recap=${w.weekKey}`} className="flex items-center gap-1 font-semibold text-accent hover:text-cyan">
                        <Play className="h-3 w-3" fill="currentColor" aria-hidden /> Recap
                      </Link>
                    </span>
                  </div>
                  {w.winner ? (
                    <Link to={`/players/${w.winner.playerId}`} className="mt-3 flex items-center gap-3">
                      <Avatar league={league} id={w.winner.playerId} size={44} ring="gold" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-display text-2xl leading-none font-bold uppercase italic">
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
