import { ChevronRight, Clock, Crown } from 'lucide-react'
import { Link } from 'react-router'
import type { League } from '../lib/queries'
import { formatPoints, groupByMonth, monthMinimum, monthResult, type MonthResult } from '../lib/stats'
import { addMonths, dayKey, durationLabel, monthCardLabel, monthKey, monthLabel, startOfDay } from '../lib/time'
import { Avatar } from './Avatar'
import { CollectibleCard } from './Potw'
import { ShareButton } from './Share'

export type MonthView = {
  /** This month so far. */
  current: MonthResult
  /** Last month, finished. */
  last: MonthResult
  /** The first week of a month, when last month's winner has just been crowned. */
  fresh: boolean
}

export function monthView(league: League, now: Date): MonthView {
  const { matches, settings, tz, nameOf } = league
  const key = monthKey(now, tz)
  const prev = addMonths(key, -1)
  const byMonth = groupByMonth(matches, tz)
  const last = monthResult(byMonth.get(prev) ?? [], settings, prev, nameOf)
  return {
    current: monthResult(byMonth.get(key) ?? [], settings, key, nameOf),
    last,
    fresh: !!last.winner && Number(dayKey(now, tz).slice(8)) <= 7,
  }
}

/** Player of the Month on Home: last month's winner (or this month's leader), and the race for this month. */
export function PotmSpotlight({ league, view, now }: { league: League; view: MonthView; now: Date }) {
  const { current, last } = view
  const leader = current.winner ?? current.rows[0] ?? null
  const crowned = last.winner
  const shown = crowned ?? leader
  const shownMonth = crowned ? last.monthKey : current.monthKey
  if (!shown) return null

  const min = monthMinimum(league.settings)
  const endsAt = startOfDay(`${addMonths(current.monthKey, 1)}-01`, league.tz)
  const row = crowned ?? leader!

  return (
    <section aria-label="Player of the Month" className="potm-section">
      <div className="potm-header">
        <h2 className="potm-heading">
          Player <span>of the month</span>
        </h2>
        <span className={`potm-pill ${crowned ? '' : 'is-live'}`}>{crowned ? monthLabel(last.monthKey) : 'Live race'}</span>
      </div>

      <div className="potm-body">
        <CollectibleCard
          kind="potm"
          league={league}
          row={row}
          month={shownMonth}
          caption={crowned ? monthCardLabel(shownMonth) : `${monthCardLabel(shownMonth)} · leader`}
          to={`/players/${row.playerId}`}
        />
        <div className="potm-details">
          <div className="potm-kicker">
            <Crown className="h-3.5 w-3.5" aria-hidden />
            {crowned ? `${monthLabel(last.monthKey)} champion` : current.winner ? 'Leading this month' : 'Leading, not qualified yet'}
          </div>
          <h3 className="potm-name">{league.nameOf(row.playerId)}</h3>
          <div className="potm-points">
            {formatPoints(row.points)}
            <small>points</small>
          </div>
          <div className="potm-record">
            {row.won}W · {row.drawn}D · {row.lost}L · {row.gf} goals · {row.played} games
          </div>

          {crowned && (
            <Link to={`/table?view=month&at=${current.monthKey}`} className="potm-race">
              <span className="potm-race-label">{monthLabel(current.monthKey).split(' ')[0]} race</span>
              {leader ? (
                <>
                  <Avatar league={league} id={leader.playerId} size={22} />
                  <span className="min-w-0 truncate font-semibold">{league.nameOf(leader.playerId)}</span>
                  <span className="shrink-0 text-[#e2c2a6]">· {formatPoints(leader.points)} pts</span>
                </>
              ) : (
                <span className="text-[#e2c2a6]">No games yet</span>
              )}
              <ChevronRight className="ml-auto h-4 w-4 shrink-0" aria-hidden />
            </Link>
          )}
          <p className="potm-note">
            <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
            {durationLabel(endsAt.getTime() - now.getTime())} left this month. Most points wins, with at least {min} games in the month.
            {!crowned && !current.winner && leader ? ` ${league.nameOf(leader.playerId)} needs ${leader.gamesNeeded} more.` : ''}
          </p>
          <ShareButton
            className="mt-4"
            label="Share card"
            name={`player-of-the-month-${shownMonth}`}
            text={
              crowned
                ? `${league.nameOf(row.playerId)} is Player of the Month for ${monthLabel(shownMonth)} 🏆`
                : `${league.nameOf(row.playerId)} leads the Player of the Month race`
            }
            make={(p) =>
              p.cardPoster(league, {
                kind: 'potm',
                row,
                month: shownMonth,
                caption: monthCardLabel(shownMonth),
                subtitle: crowned ? `${monthLabel(shownMonth)} champion` : `${monthLabel(shownMonth)} · live race`,
              })
            }
          />
        </div>
      </div>
    </section>
  )
}
