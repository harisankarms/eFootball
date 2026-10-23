import { BrickWall, ChevronRight, Clock, Crown, Footprints, Plus, Utensils, Zap, type LucideIcon } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { inkOn } from '../lib/colors'
import { useAuth, type League } from '../lib/queries'
import { cardRating, formatPoints, sideOf, winnerOf, type Awards, type Row, type WeekResult } from '../lib/stats'
import { addDays, durationLabel, startOfDay, weekLabel } from '../lib/time'
import { roundLike, useCountUp } from '../lib/useCountUp'
import { Avatar, initials } from './Avatar'
import { FormChips } from './FormChips'
import { GlowIcon, buttonClass, type Tint } from './ui'
import './potw.css'

function CountUp({ value }: { value: number }) {
  const shown = useCountUp(value)
  return <>{roundLike(shown, value)}</>
}

/** Tilts the card towards the mouse pointer, like holding a real card. */
function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const onPointerMove = (e: PointerEvent<T>) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.dataset.tilting = ''
    el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`)
  }
  const onPointerLeave = () => {
    const el = ref.current
    if (!el) return
    delete el.dataset.tilting
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }
  return { ref, onPointerMove, onPointerLeave }
}

type CollectibleProps = {
  league: League
  /** The player's numbers for the week, or null for an empty "up for grabs" card. */
  row: Row | null
  caption: string
  mini?: boolean
  to?: string
}

/** A gold, eFootball-style player card with the player's photo (or initials), rating and weekly stats. */
export function CollectibleCard({ league, row, caption, mini = false, to }: CollectibleProps) {
  const tilt = useTilt<HTMLAnchorElement>()
  const [broken, setBroken] = useState(false)
  const id = row?.playerId
  const player = id ? league.byId.get(id) : undefined
  const color = id ? league.colorOf(id) : '#3b4566'
  const photo = player?.avatar_url && !broken ? player.avatar_url : null
  const name = player?.name ?? 'Up for grabs'
  const rating = row ? cardRating(row) : null
  const stats = [
    { label: 'Goals', value: row?.gf },
    { label: 'Wins', value: row?.won },
    { label: mini ? 'CS' : 'Clean sheets', value: row?.cleanSheets },
  ]

  const inner = (
    <div className="potw-card-inner" aria-hidden>
      <div className="potw-card-top">
        <div>
          <div className="potw-rating">{rating ?? '??'}</div>
          <div className="potw-position">POTW</div>
        </div>
        <Crown className="potw-award-icon" />
      </div>
      <div className="potw-card-art">
        <div className="potw-card-rays" />
        <div className="potw-card-halo" />
        <div
          className="potw-portrait"
          style={photo ? undefined : { background: `radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.3), transparent 55%), ${color}` }}
        >
          {photo ? (
            <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          ) : (
            <span className="potw-portrait-initials" style={{ color: row ? inkOn(color) : '#d6deef' }}>
              {row ? initials(name) : '?'}
            </span>
          )}
        </div>
      </div>
      <div className="potw-card-player-name">{name}</div>
      <div className="potw-card-label">{caption}</div>
      <div className="potw-card-divider" />
      <div className="potw-card-stats">
        {stats.map((s) => (
          <div key={s.label} className="potw-card-stat">
            <strong>{s.value ?? '–'}</strong>
            <span>{s.label.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const className = `potw-card ${mini ? 'is-mini' : ''} ${row ? '' : 'is-empty'}`
  const label = row ? `${name}: ${caption}, card rating ${rating}` : 'Player of the Week card: up for grabs'
  if (!to) {
    return (
      <div className={className} role="img" aria-label={label}>
        {inner}
      </div>
    )
  }
  return (
    <Link to={to} ref={tilt.ref} className={className} aria-label={label} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
      {inner}
    </Link>
  )
}

type HeroProps = { league: League; week: WeekResult; lastWeek: WeekResult | null; now: Date }

/** The Player of the Week section on Home: the leader's card beside their weekly numbers. */
export function PotwHero({ league, week, lastWeek, now }: HeroProps) {
  const { isMember, session } = useAuth()
  const endsAt = startOfDay(addDays(week.weekKey, 7), league.tz)
  const featured = week.winner ?? week.rows[0] ?? null
  const qualified = !!week.winner
  const rank = featured ? week.rows.findIndex((r) => r.playerId === featured.playerId) + 1 : null
  const min = league.settings.potw_min_matches

  return (
    <section aria-label="Player of the Week" className="potw-section">
      <div className="potw-header">
        <div>
          <h2 className="potw-heading">
            Player <span>of the week</span>
          </h2>
          <p className="potw-subheading">{weekLabel(week.weekKey)} · Live race</p>
        </div>
        <div className="potw-countdown">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {durationLabel(endsAt.getTime() - now.getTime())} left
        </div>
      </div>

      <div className="potw-content">
        <CollectibleCard
          league={league}
          row={featured}
          caption={featured ? (qualified ? 'Player of the week' : 'Race leader') : 'Up for grabs'}
          to={featured ? `/players/${featured.playerId}` : undefined}
        />

        <div className="potw-details">
          {featured ? (
            <>
              <div className={`potw-winner-badge ${qualified ? '' : 'is-muted'}`}>
                <Crown className="h-3.5 w-3.5" aria-hidden />
                {qualified ? 'Leading this week' : 'Leading, not qualified yet'}
              </div>
              <h3 className="potw-player-name">{league.nameOf(featured.playerId)}</h3>
              <div className="potw-player-caption">
                <span>
                  {featured.won}W · {featured.drawn}D · {featured.lost}L this week
                </span>
                <FormChips form={featured.form} size="xs" />
              </div>
              <div className="potw-stats-grid">
                <div className="potw-stat-box">
                  <span>GOALS</span>
                  <strong>{featured.gf}</strong>
                </div>
                <div className="potw-stat-box">
                  <span>WINS</span>
                  <strong>{featured.won}</strong>
                </div>
                <div className="potw-stat-box">
                  <span>CLEAN SHEETS</span>
                  <strong>{featured.cleanSheets}</strong>
                </div>
              </div>
              <div className="potw-points-panel">
                <div className="potw-points-info">
                  <span>TOTAL WEEKLY POINTS</span>
                  <strong>
                    <CountUp value={featured.points} />
                  </strong>
                </div>
                <div className="potw-rank">
                  <span>WEEKLY RANK</span>
                  <strong>#{rank}</strong>
                </div>
              </div>
              {!qualified && (
                <p className="potw-footnote">
                  Needs {featured.gamesNeeded} more game{featured.gamesNeeded === 1 ? '' : 's'} to qualify (minimum {min} a week).
                </p>
              )}
            </>
          ) : (
            <>
              <div className="potw-winner-badge is-muted">
                <Crown className="h-3.5 w-3.5" aria-hidden />
                The race is open
              </div>
              <h3 className="potw-player-name">No leader yet</h3>
              <p className="potw-player-caption">
                Play at least {min} games this week to qualify. Most points by Sunday midnight takes the crown.
              </p>
              {(isMember || !session) && (
                <Link to="/add" className={buttonClass('primary', 'lg')}>
                  <Plus className="h-5 w-5" aria-hidden strokeWidth={2.75} /> Log a result
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {lastWeek?.winner && (
        <Link to="/hall-of-fame" className="potw-last-week">
          <span className="text-muted">Last week</span>
          <Avatar league={league} id={lastWeek.winner.playerId} size={24} />
          <span className="truncate font-semibold text-ink">{league.nameOf(lastWeek.winner.playerId)}</span>
          <span className="shrink-0 text-muted">· {formatPoints(lastWeek.winner.points)} pts</span>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted" aria-hidden />
        </Link>
      )}
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
