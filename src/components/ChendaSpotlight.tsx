import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { League } from '../lib/queries'
import { formatPerGame, type WeekResult } from '../lib/stats'
import { Avatar } from './Avatar'
import { CollectibleCard } from './Potw'

type Props = { league: League; week: WeekResult; lastWeek: WeekResult | null }

/** The week's chenda on Home: whoever is doing worst per game this week, or last week's if nobody is yet. */
export function ChendaSpotlight({ league, week, lastWeek }: Props) {
  const live = week.awards.chenda
  const last = lastWeek?.awards.chenda ?? null
  const shown = live ?? last
  const min = league.settings.potw_min_matches

  const note = live
    ? `Fewest points a game this week among players with ${min}+ games. Decided on Sunday at midnight.`
    : last
      ? `Nobody's on the drum yet this week. It starts once three players have ${min}+ games.`
      : `Whoever has the fewest points a game when the week ends gets the chenda. Needs three players with ${min}+ games.`

  return (
    <section aria-label="Chenda of the week" className="chenda-section">
      <div className="chenda-header">
        <h2 className="chenda-heading">
          Chenda <span>of the week</span>
        </h2>
        <span className={`chenda-pill ${live ? 'is-live' : ''}`}>{live ? 'Live' : last ? 'Last week' : 'Nobody yet'}</span>
      </div>

      <div className="chenda-body">
        <CollectibleCard
          kind="chenda"
          league={league}
          row={shown}
          caption={live ? 'Chenda of the week' : last ? "Last week's chenda" : 'Chenda of the week'}
          to={shown ? `/players/${shown.playerId}` : undefined}
        />
        <div className="min-w-0">
          <h3 className="chenda-name">{shown ? league.nameOf(shown.playerId) : 'Nobody yet'}</h3>
          {shown && (
            <>
              <div className="chenda-figure">
                {formatPerGame(shown)}
                <small>pts a game</small>
              </div>
              <div className="chenda-record">
                {shown.won}W · {shown.drawn}D · {shown.lost}L · {shown.gf}–{shown.ga}
              </div>
            </>
          )}
          <p className="chenda-note">{note}</p>
        </div>
      </div>

      {live && last && (
        <Link to="/hall-of-fame" className="chenda-last">
          <span className="text-[#c6a58e]">Last week</span>
          <Avatar league={league} id={last.playerId} size={24} />
          <span className="truncate font-semibold text-[#fff4e8]">{league.nameOf(last.playerId)}</span>
          <span className="shrink-0 text-[#c6a58e]">· {formatPerGame(last)} pts a game</span>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[#c6a58e]" aria-hidden />
        </Link>
      )}
    </section>
  )
}
