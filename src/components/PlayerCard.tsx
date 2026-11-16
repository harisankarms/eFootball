import { TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import type { League } from '../lib/queries'
import { changeSince, formatRating, overallRating, type Ratings } from '../lib/rating'
import { buildTable } from '../lib/stats'
import { startOfDay, weekKey } from '../lib/time'
import { CollectibleCard } from './Potw'
import { ShareButton } from './Share'

/** A player's own card on their profile: overall rating from the form rating, career numbers, their colour. */
export function PlayerCardSection({ league, id, all, now }: { league: League; id: string; all: Ratings; now: Date }) {
  const career = useMemo(() => buildTable(league.matches, league.settings, 0, league.nameOf).find((r) => r.playerId === id) ?? null, [league, id])
  const history = all.history.get(id)
  if (!career || !history?.length) return null

  const name = league.nameOf(id)
  const color = league.colorOf(id)
  const rating = all.current.get(id) ?? 0
  const ovr = overallRating(rating)
  const weekStart = startOfDay(weekKey(now, league.tz), league.tz).getTime()
  const delta = ovr - overallRating(rating - changeSince(history, weekStart))
  const rank = all.rank.get(id)
  const caption = `Form ${formatRating(rating)}`

  return (
    <section
      className="card grid items-center gap-5 overflow-hidden p-5 sm:grid-cols-[minmax(0,230px)_1fr]"
      style={{ backgroundImage: `radial-gradient(70% 60% at 25% 40%, color-mix(in srgb, ${color} 18%, transparent), transparent 70%)` }}
    >
      <div className="mx-auto w-[min(68%,240px)] sm:w-full">
        <CollectibleCard kind="player" league={league} row={career} overall={ovr} caption={caption} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">Player card</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-5xl leading-none font-bold">{ovr}</span>
          <span className="font-semibold text-muted">OVR</span>
          {delta !== 0 && (
            <span className={`inline-flex items-center gap-1 text-sm font-semibold ${delta > 0 ? 'text-accent' : 'text-[#ff9b9b]'}`}>
              {delta > 0 ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
              {delta > 0 ? `+${delta}` : delta} this week
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-2">
          Comes from the form rating ({formatRating(rating)}, #{rank} of {all.current.size}). Wins push it up, more against stronger players, and
          losses bring it down. Everyone starts at 75.
        </p>
        <ShareButton
          className="mt-4"
          label="Share card"
          name={`${name}-player-card`}
          text={`${name}'s player card: ${ovr} OVR`}
          make={(p) =>
            p.cardPoster(league, {
              kind: 'player',
              row: career,
              overall: ovr,
              caption,
              subtitle: `${name} · #${rank} of ${all.current.size}`,
              line: `${ovr} OVR · ${career.won}W ${career.drawn}D ${career.lost}L · ${career.gf} goals`,
            })
          }
        />
      </div>
    </section>
  )
}
