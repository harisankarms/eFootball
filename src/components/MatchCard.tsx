import { ImageOff } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../lib/backend'
import type { League } from '../lib/queries'
import { winnerOf } from '../lib/stats'
import { clockTime, shortDate } from '../lib/time'
import type { Match } from '../lib/types'
import { Avatar } from './Avatar'
import { Badge } from './ui'

export function MatchCard({ match, league, showDate = false }: { match: Match; league: League; showDate?: boolean }) {
  const winner = winnerOf(match)
  const thumb = api.imageUrl(match.thumb_path ?? match.screenshot_path)
  const sides = [
    { id: match.home_id, goals: match.home_goals },
    { id: match.away_id, goals: match.away_goals },
  ]
  return (
    <Link to={`/match/${match.id}`} className="group card card-hover flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        {sides.map((s) => {
          const won = winner === s.id
          return (
            <div key={s.id} className="flex items-center gap-2.5">
              <Avatar league={league} id={s.id} size={26} />
              <span className={`truncate text-[15px] ${won ? 'font-semibold text-ink' : winner ? 'text-ink-2' : 'text-ink'}`}>
                {league.nameOf(s.id)}
              </span>
              {match.pens_winner_id === s.id && <Badge tone="gold">Pens</Badge>}
              <span
                className={`ml-auto grid h-7 min-w-7 place-items-center rounded-lg px-1.5 text-lg leading-none font-bold tabular-nums ${
                  won ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgb(61_255_143/0.3)]' : winner ? 'text-ink-2' : 'text-ink'
                }`}
              >
                {s.goals}
              </span>
            </div>
          )
        })}
        <div className="flex items-center gap-2 pt-0.5 text-xs text-muted">
          <span>
            {showDate ? `${shortDate(match.played_at, league.tz)} · ` : ''}
            {clockTime(match.played_at, league.tz)}
          </span>
          {match.status === 'disputed' && <Badge tone="warn">Disputed</Badge>}
        </div>
      </div>
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted">
            <ImageOff className="h-5 w-5" aria-label="No screenshot" />
          </div>
        )}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]" />
      </div>
    </Link>
  )
}
