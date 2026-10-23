import { BrickWall, ChevronRight, Clock, Crown, Footprints, Utensils, Zap, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { League } from '../lib/queries'
import { formatPoints, sideOf, winnerOf, type Awards, type WeekResult } from '../lib/stats'
import { addDays, durationLabel, startOfDay, weekLabel } from '../lib/time'
import { roundLike, useCountUp } from '../lib/useCountUp'
import { Avatar } from './Avatar'
import { FormChips } from './FormChips'
import { GlowIcon, type Tint } from './ui'

function Sparkle({ className = '', delay = '0s' }: { className?: string; delay?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`pointer-events-none absolute animate-twinkle text-gold ${className}`} style={{ animationDelay: delay }} aria-hidden>
      <path fill="currentColor" d="M12 0c.6 5.6 6.4 11.4 12 12-5.6.6-11.4 6.4-12 12-.6-5.6-6.4-11.4-12-12C5.6 11.4 11.4 5.6 12 0z" />
    </svg>
  )
}

function CountUp({ value, className = '' }: { value: number; className?: string }) {
  const shown = useCountUp(value)
  return <span className={className}>{roundLike(shown, value)}</span>
}

type CardProps = { league: League; week: WeekResult; lastWeek: WeekResult | null; now: Date }

export function PotwCard({ league, week, lastWeek, now }: CardProps) {
  const endsAt = startOfDay(addDays(week.weekKey, 7), league.tz)
  const featured = week.winner ?? week.rows[0] ?? null
  const qualified = !!week.winner
  const min = league.settings.potw_min_matches

  return (
    <section aria-label="Player of the Week" className="potw-frame">
      <div className="relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-[radial-gradient(120%_90%_at_0%_0%,rgb(255_207_77/0.2),transparent_55%),radial-gradient(90%_80%_at_100%_100%,rgb(139_92_246/0.2),transparent_60%),linear-gradient(180deg,#141c3a,#0a1128)] p-5">
        <div aria-hidden className="pointer-events-none absolute -top-28 left-[18%] h-72 w-20 rotate-[24deg] bg-[linear-gradient(180deg,rgb(255_236_179/0.16),transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute -top-28 right-[22%] h-72 w-16 -rotate-[22deg] bg-[linear-gradient(180deg,rgb(167_139_250/0.14),transparent_75%)]" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-gold drop-shadow-[0_0_8px_rgb(255_207_77/0.7)]" aria-hidden />
            <span className="font-display text-lg font-bold tracking-[0.12em] uppercase italic text-gradient-gold">Player of the Week</span>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-semibold text-ink-2">{weekLabel(week.weekKey)}</div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
              <Clock className="h-3 w-3" aria-hidden />
              {durationLabel(endsAt.getTime() - now.getTime())} left
            </div>
          </div>
        </div>

        {featured ? (
          <>
            <Link to={`/players/${featured.playerId}`} className="relative mt-6 flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar league={league} id={featured.playerId} size={84} ring={qualified ? 'gold' : undefined} />
                {qualified && (
                  <>
                    <Crown
                      className="absolute -top-5 -right-2 h-8 w-8 animate-float fill-gold/40 text-gold drop-shadow-[0_0_10px_rgb(255_207_77/0.8)] [--float-rotate:14deg]"
                      aria-hidden
                    />
                    <Sparkle className="-top-2 -left-3 h-3.5 w-3.5" />
                    <Sparkle className="top-9 -left-5 h-2.5 w-2.5" delay="0.9s" />
                    <Sparkle className="-bottom-2 left-1 h-3 w-3" delay="1.7s" />
                  </>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-[2.8rem] leading-none font-bold tracking-wide uppercase italic">
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

            <dl className="relative mt-6 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3 border-t border-white/10 pt-4">
              <div>
                <dd className="text-[3.4rem] leading-none font-semibold tracking-tight drop-shadow-[0_0_18px_rgb(255_207_77/0.35)]">
                  <CountUp value={featured.points} />
                </dd>
                <dt className="mt-1.5 text-xs text-muted">points</dt>
              </div>
              <div>
                <dd className="text-2xl leading-none font-semibold">
                  <CountUp value={featured.gf} />
                </dd>
                <dt className="mt-1.5 text-xs text-muted">goals</dt>
              </div>
              <div>
                <dd className="text-2xl leading-none font-semibold">
                  <CountUp value={featured.cleanSheets} />
                </dd>
                <dt className="mt-1.5 text-xs text-muted">clean sheets</dt>
              </div>
            </dl>

            {!qualified && (
              <p className="relative mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-ink-2">
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
            className="relative mt-4 flex items-center gap-2.5 border-t border-white/10 pt-3.5 text-sm text-ink-2 transition hover:text-ink"
          >
            <span className="text-muted">Last week</span>
            <Avatar league={league} id={lastWeek.winner.playerId} size={22} />
            <span className="truncate font-semibold text-ink">{league.nameOf(lastWeek.winner.playerId)}</span>
            <span className="shrink-0 text-muted">· {formatPoints(lastWeek.winner.points)} pts</span>
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}

type AwardItem = { icon: LucideIcon; tint: Tint; glow: string; label: string; ids: string[]; detail: string | null }

export function awardItems(league: League, awards: Awards): AwardItem[] {
  const big = awards.biggestWin
  const bigWinner = big ? winnerOf(big) : null
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return [
    {
      icon: Footprints,
      tint: 'gold',
      glow: 'rgb(255 207 77 / 0.16)',
      label: 'Golden Boot',
      ids: awards.goldenBoot?.ids ?? [],
      detail: awards.goldenBoot ? plural(awards.goldenBoot.goals, 'goal') : null,
    },
    {
      icon: BrickWall,
      tint: 'cyan',
      glow: 'rgb(34 211 238 / 0.14)',
      label: 'The Wall',
      ids: awards.wall?.ids ?? [],
      detail: awards.wall ? plural(awards.wall.cleanSheets, 'clean sheet') : null,
    },
    {
      icon: Zap,
      tint: 'accent',
      glow: 'rgb(61 255 143 / 0.14)',
      label: 'Biggest Win',
      ids: bigWinner ? [bigWinner] : [],
      detail:
        big && bigWinner
          ? `${sideOf(big, bigWinner).gf}–${sideOf(big, bigWinner).ga} vs ${league.nameOf(sideOf(big, bigWinner).opponentId)}`
          : null,
    },
    {
      icon: Utensils,
      tint: 'violet',
      glow: 'rgb(139 92 246 / 0.16)',
      label: 'Wooden Spoon',
      ids: awards.woodenSpoon ? [awards.woodenSpoon.playerId] : [],
      detail: awards.woodenSpoon ? `${formatPoints(awards.woodenSpoon.points)} pts` : null,
    },
  ]
}

export function AwardsStrip({ league, awards }: { league: League; awards: Awards }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
      {awardItems(league, awards).map((a) => (
        <div key={a.label} className="card card-hover min-w-[46%] snap-start overflow-hidden p-3.5 sm:min-w-[30%] md:min-w-0">
          <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full" style={{ background: `radial-gradient(circle, ${a.glow}, transparent 70%)` }} />
          <div className="relative flex items-center gap-2.5">
            <GlowIcon icon={a.icon} tint={a.tint} size="sm" />
            <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">{a.label}</span>
          </div>
          {a.ids.length ? (
            <>
              <div className="relative mt-3 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {a.ids.slice(0, 3).map((id) => (
                    <Avatar key={id} league={league} id={id} size={24} className="ring-2 ring-surface" />
                  ))}
                </div>
                <span className="truncate font-semibold">{a.ids.map(league.nameOf).join(' & ')}</span>
              </div>
              <div className="relative mt-1 truncate text-xs text-ink-2">{a.detail}</div>
            </>
          ) : (
            <div className="relative mt-3 text-sm text-muted">Up for grabs</div>
          )}
        </div>
      ))}
    </div>
  )
}
