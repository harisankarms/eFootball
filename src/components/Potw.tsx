import { BrickWall, ChevronRight, Crown, Footprints, Utensils, Zap, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { League } from '../lib/queries'
import { formatPoints, sideOf, winnerOf, type Awards, type WeekResult } from '../lib/stats'
import { addDays, durationLabel, startOfDay, weekLabel } from '../lib/time'
import { Avatar } from './Avatar'
import { FormChips } from './FormChips'

function PitchMarks({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="100" cy="100" r="60" />
      <circle cx="100" cy="100" r="3" fill="currentColor" />
      <line x1="100" y1="0" x2="100" y2="200" />
    </svg>
  )
}

type CardProps = { league: League; week: WeekResult; lastWeek: WeekResult | null; now: Date }

export function PotwCard({ league, week, lastWeek, now }: CardProps) {
  const endsAt = startOfDay(addDays(week.weekKey, 7), league.tz)
  const featured = week.winner ?? week.rows[0] ?? null
  const qualified = !!week.winner
  const min = league.settings.potw_min_matches

  return (
    <section
      aria-label="Player of the Week"
      className="relative overflow-hidden rounded-3xl border border-gold/25 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(255_201_77/0.16),transparent_60%),linear-gradient(180deg,var(--color-surface-2),var(--color-surface))] p-5"
    >
      <PitchMarks className="pointer-events-none absolute -top-12 -right-14 h-64 w-64 text-gold/[0.07]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-gold">
          <Crown className="h-4.5 w-4.5" aria-hidden />
          <span className="font-display text-lg font-bold tracking-[0.14em] uppercase">Player of the Week</span>
        </div>
        <div className="shrink-0 text-right text-xs leading-relaxed text-muted">
          <div className="font-semibold text-ink-2">{weekLabel(week.weekKey)}</div>
          <div>ends in {durationLabel(endsAt.getTime() - now.getTime())}</div>
        </div>
      </div>

      {featured ? (
        <>
          <Link to={`/players/${featured.playerId}`} className="relative mt-5 flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar league={league} id={featured.playerId} size={76} ring={qualified ? 'gold' : undefined} />
              {qualified && <Crown className="absolute -top-3.5 -right-2 h-7 w-7 rotate-[14deg] fill-gold/30 text-gold drop-shadow" aria-hidden />}
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-[2.6rem] leading-none font-bold tracking-wide uppercase">
                {league.nameOf(featured.playerId)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-2">
                <span>
                  {featured.won}W · {featured.drawn}D · {featured.lost}L
                </span>
                <FormChips form={featured.form} size="xs" />
              </div>
            </div>
          </Link>

          <dl className="relative mt-5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3 border-t border-line/70 pt-4">
            <div>
              <dd className="text-[3.25rem] leading-none font-semibold tracking-tight">{formatPoints(featured.points)}</dd>
              <dt className="mt-1.5 text-xs text-muted">points</dt>
            </div>
            <div>
              <dd className="text-2xl leading-none font-semibold">{featured.gf}</dd>
              <dt className="mt-1.5 text-xs text-muted">goals</dt>
            </div>
            <div>
              <dd className="text-2xl leading-none font-semibold">{featured.cleanSheets}</dd>
              <dt className="mt-1.5 text-xs text-muted">clean sheets</dt>
            </div>
          </dl>

          {!qualified && (
            <p className="relative mt-4 rounded-xl bg-surface-3/70 px-3 py-2 text-xs text-ink-2">
              Leading the race, but needs {featured.gamesNeeded} more game{featured.gamesNeeded === 1 ? '' : 's'} to qualify (minimum {min} a
              week).
            </p>
          )}
        </>
      ) : (
        <p className="relative mt-6 mb-2 text-ink-2">
          No games yet this week. The race is wide open: play at least {min} games to qualify.
        </p>
      )}

      {lastWeek?.winner && (
        <Link
          to="/hall-of-fame"
          className="relative mt-4 flex items-center gap-2.5 border-t border-line/70 pt-3.5 text-sm text-ink-2 hover:text-ink"
        >
          <span className="text-muted">Last week</span>
          <Avatar league={league} id={lastWeek.winner.playerId} size={22} />
          <span className="truncate font-semibold text-ink">{league.nameOf(lastWeek.winner.playerId)}</span>
          <span className="shrink-0 text-muted">· {formatPoints(lastWeek.winner.points)} pts</span>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted" aria-hidden />
        </Link>
      )}
    </section>
  )
}

type AwardItem = { icon: LucideIcon; tint: string; label: string; ids: string[]; detail: string | null }

export function awardItems(league: League, awards: Awards): AwardItem[] {
  const big = awards.biggestWin
  const bigWinner = big ? winnerOf(big) : null
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return [
    {
      icon: Footprints,
      tint: 'bg-gold/15 text-gold',
      label: 'Golden Boot',
      ids: awards.goldenBoot?.ids ?? [],
      detail: awards.goldenBoot ? plural(awards.goldenBoot.goals, 'goal') : null,
    },
    {
      icon: BrickWall,
      tint: 'bg-[#38bdf8]/15 text-[#7dd3fc]',
      label: 'The Wall',
      ids: awards.wall?.ids ?? [],
      detail: awards.wall ? plural(awards.wall.cleanSheets, 'clean sheet') : null,
    },
    {
      icon: Zap,
      tint: 'bg-accent/12 text-accent',
      label: 'Biggest Win',
      ids: bigWinner ? [bigWinner] : [],
      detail:
        big && bigWinner
          ? `${sideOf(big, bigWinner).gf}–${sideOf(big, bigWinner).ga} vs ${league.nameOf(sideOf(big, bigWinner).opponentId)}`
          : null,
    },
    {
      icon: Utensils,
      tint: 'bg-surface-3 text-ink-2',
      label: 'Wooden Spoon',
      ids: awards.woodenSpoon ? [awards.woodenSpoon.playerId] : [],
      detail: awards.woodenSpoon ? `${formatPoints(awards.woodenSpoon.points)} pts` : null,
    },
  ]
}

export function AwardsStrip({ league, awards }: { league: League; awards: Awards }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
      {awardItems(league, awards).map((a) => (
        <div key={a.label} className="card min-w-[44%] snap-start p-3.5 sm:min-w-[30%] md:min-w-0">
          <div className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center rounded-lg ${a.tint}`}>
              <a.icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">{a.label}</span>
          </div>
          {a.ids.length ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {a.ids.slice(0, 3).map((id) => (
                    <Avatar key={id} league={league} id={id} size={24} className="ring-2 ring-surface" />
                  ))}
                </div>
                <span className="truncate font-semibold">{a.ids.map(league.nameOf).join(' & ')}</span>
              </div>
              <div className="mt-1 truncate text-xs text-ink-2">{a.detail}</div>
            </>
          ) : (
            <div className="mt-3 text-sm text-muted">Up for grabs</div>
          )}
        </div>
      ))}
    </div>
  )
}
