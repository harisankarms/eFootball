import { Link } from 'react-router'
import { formatStat, type StatLeader } from '../lib/matchStats'
import type { League } from '../lib/queries'
import { Avatar } from './Avatar'

/** Who leads each screenshot stat, one row per stat. */
export function StatLeaders({ league, leaders }: { league: League; leaders: StatLeader[] }) {
  return (
    <div className="card divide-y divide-line/70">
      {leaders.map((l) => (
        <Link key={l.title} to={`/players/${l.playerId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{l.title}</div>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <Avatar league={league} id={l.playerId} size={24} />
              <span className="truncate font-semibold">{league.nameOf(l.playerId)}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-bold tabular-nums">{formatStat(l.value, l.percent)}</div>
            <div className="text-[11px] text-muted">
              {l.detail} · {l.matches} match{l.matches === 1 ? '' : 'es'}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
