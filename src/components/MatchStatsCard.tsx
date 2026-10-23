import { STAT_LABELS, type StatKey } from '../lib/matchStats'
import type { League } from '../lib/queries'
import type { Match } from '../lib/types'
import { Avatar } from './Avatar'

/** The full-time stats read from the screenshot, as home and away values with a bar showing who had more. */
export function MatchStatsCard({ league, match }: { league: League; match: Match }) {
  const stats = match.details?.stats
  const keys = (Object.keys(STAT_LABELS) as StatKey[]).filter((k) => stats?.[k])
  if (!stats || keys.length === 0) return null

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-2">Match stats</h2>
        <span className="text-[11px] text-muted">Read from the screenshot</span>
      </div>
      <div className="mb-3.5 flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar league={league} id={match.home_id} size={22} />
          <span className="truncate">{league.nameOf(match.home_id)}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{league.nameOf(match.away_id)}</span>
          <Avatar league={league} id={match.away_id} size={22} />
        </span>
      </div>
      <ul className="space-y-3">
        {keys.map((k) => {
          const [home, away] = stats[k]!
          const unit = k === 'possession' ? '%' : ''
          const total = home + away
          return (
            <li key={k}>
              <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                <span className={home > away ? 'font-bold text-ink' : 'text-ink-2'}>
                  {home}
                  {unit}
                </span>
                <span className="text-center text-xs text-muted">{STAT_LABELS[k]}</span>
                <span className={away > home ? 'font-bold text-ink' : 'text-ink-2'}>
                  {away}
                  {unit}
                </span>
              </div>
              <div className="mt-1.5 flex h-1.5 gap-0.5" aria-hidden>
                <span className={`rounded-l-full ${home > away ? 'bg-accent' : 'bg-line-strong'}`} style={{ flex: total ? home : 1 }} />
                <span className={`rounded-r-full ${away > home ? 'bg-accent' : 'bg-line-strong'}`} style={{ flex: total ? away : 1 }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
