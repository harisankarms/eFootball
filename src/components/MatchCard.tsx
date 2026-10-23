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
    <Link
      to={`/match/${match.id}`}
      className="card flex items-center gap-3 p-3 transition hover:border-line-strong hover:bg-surface-2/40"
    >
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
              <span className={`ml-auto pl-2 text-lg leading-none font-bold tabular-nums ${won ? 'text-ink' : 'text-ink-2'}`}>
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
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="h-16 w-24 shrink-0 rounded-xl border border-line object-cover"
        />
      ) : (
        <div className="grid h-16 w-24 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-muted">
          <ImageOff className="h-5 w-5" aria-label="No screenshot" />
        </div>
      )}
    </Link>
  )
}
