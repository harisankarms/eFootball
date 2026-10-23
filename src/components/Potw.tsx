import { BrickWall, ChevronRight, Clock, Crown, Flame, Footprints, Plus, Utensils, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { Link } from 'react-router'
import { inkOn } from '../lib/colors'
import { useAuth, type League } from '../lib/queries'
import { cardRating, formatPoints, sideOf, winnerOf, type Awards, type Row, type WeekResult } from '../lib/stats'
import { addDays, durationLabel, startOfDay, weekLabel } from '../lib/time'
import { roundLike, useCountUp } from '../lib/useCountUp'
import { Avatar, initials } from './Avatar'
import { EMPTY_TUNNEL, EPIC_TUNNEL, TUNNEL_START, createTunnel, readyTunnelStill, tunnelStill } from './epicTunnel'
import { FormChips } from './FormChips'
import { GlowIcon, buttonClass, type Tint } from './ui'
import './potw.css'

function CountUp({ value }: { value: number }) {
  const shown = useCountUp(value)
  return <>{roundLike(shown, value)}</>
}

/** Tilts the card towards the mouse pointer, like holding a real card. */
function useTilt(ref: RefObject<HTMLElement | null>) {
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
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
  return { onPointerMove, onPointerLeave }
}

/** Whether the card is on screen, so the background animation can pause while it is scrolled away. */
function useOnScreen(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [onScreen, setOnScreen] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      setOnScreen(entry.isIntersecting)
      if (entry.isIntersecting) delete el.dataset.offscreen
      else el.dataset.offscreen = ''
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, enabled])
  return onScreen
}

const MAX_SCALE = 1.5

/** The moving honeycomb flight behind the big card, drawn with WebGL; the SVG tunnel stands in without it. */
function LiveTunnel({ empty, active }: { empty: boolean; active: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  const wakeRef = useRef(() => {})
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    activeRef.current = active
    wakeRef.current()
  }, [active])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const canvas = document.createElement('canvas')
    canvas.className = 'epic-gl'
    const tunnel = createTunnel(canvas, empty ? EMPTY_TUNNEL : EPIC_TUNNEL)
    if (!tunnel) {
      setFallback(true)
      return
    }
    box.append(canvas)

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const started = performance.now()
    const now = () => (still ? TUNNEL_START : TUNNEL_START + (performance.now() - started) / 1000)
    let scale = Math.min(window.devicePixelRatio || 1, MAX_SCALE)
    const fit = () => {
      tunnel.resize(box.clientWidth * scale, box.clientHeight * scale)
      tunnel.draw(now())
    }

    // Drops to a lower resolution on phones that can't keep up.
    let frame = 0
    let last = 0
    let slow = 0
    const loop = (time: number) => {
      if (last && time - last > 28 && scale > 1 && ++slow > 20) {
        scale = 1
        fit()
      }
      last = time
      tunnel.draw(now())
      frame = activeRef.current && !still ? requestAnimationFrame(loop) : 0
    }
    const wake = () => {
      if (frame) return
      last = 0
      loop(performance.now())
    }

    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(box)
    const lost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(frame)
      canvas.remove()
      setFallback(true)
    }
    canvas.addEventListener('webglcontextlost', lost)
    wakeRef.current = wake
    wake()

    return () => {
      cancelAnimationFrame(frame)
      wakeRef.current = () => {}
      resize.disconnect()
      canvas.removeEventListener('webglcontextlost', lost)
      tunnel.destroy()
      canvas.remove()
    }
  }, [empty])

  return (
    <>
      {fallback && <EpicTunnel />}
      <div ref={boxRef} className="epic-live" />
    </>
  )
}

/** One frame of the honeycomb flight as a picture, shared by every small card on the page. */
function StillTunnel({ empty }: { empty: boolean }) {
  const colors = empty ? EMPTY_TUNNEL : EPIC_TUNNEL
  const [url, setUrl] = useState(() => readyTunnelStill(colors))
  useEffect(() => {
    let alive = true
    void tunnelStill(colors, 360, 515).then((made) => {
      if (alive) setUrl(made)
    })
    return () => {
      alive = false
    }
  }, [colors])
  if (url === undefined) return null
  return url ? <img className="epic-still" src={url} alt="" /> : <EpicTunnel />
}

const CENTRE = { x: 50, y: 62 }
const RINGS = 9
const ZOOM_SECONDS = 6.5

function hexagon(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${(CENTRE.x + r * Math.cos(a)).toFixed(2)},${(CENTRE.y + r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

/** The animated neon hexagon tunnel behind the player, as on eFootball 2026 Epic cards. */
function EpicTunnel() {
  const id = useId()
  const ring = hexagon(34)
  return (
    <svg className="epic-tunnel" viewBox="0 0 100 143" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="43%" r="72%">
          <stop offset="0" style={{ stopColor: 'var(--tunnel-1)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--tunnel-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--tunnel-3)' }} />
        </radialGradient>
        <radialGradient id={`${id}core`}>
          <stop offset="0" stopColor="#f2fff4" stopOpacity="0.95" />
          <stop offset="0.35" style={{ stopColor: 'var(--neon)' }} stopOpacity="0.6" />
          <stop offset="1" style={{ stopColor: 'var(--neon)' }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="143" fill={`url(#${id}bg)`} />
      <g className="epic-spokes">
        {Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 2
          return <line key={i} x1={CENTRE.x} y1={CENTRE.y} x2={CENTRE.x + 140 * Math.cos(a)} y2={CENTRE.y + 140 * Math.sin(a)} />
        })}
      </g>
      {Array.from({ length: RINGS }, (_, i) => (
        <g
          key={i}
          className="epic-ring"
          style={{
            animationDelay: `${(-(i * ZOOM_SECONDS) / RINGS).toFixed(2)}s`,
            transform: `scale(${(0.08 * 1.45 ** i).toFixed(3)})`,
          }}
        >
          <polygon points={ring} className="epic-ring-glow" />
          <polygon points={ring} className="epic-ring-edge" />
          <polygon points={ring} className="epic-ring-line" />
        </g>
      ))}
      <circle cx={CENTRE.x} cy={CENTRE.y} r="18" fill={`url(#${id}core)`} className="epic-core" />
    </svg>
  )
}

/** Bronze frame lines, corner accents and the bottom plate, drawn over the card. */
function EpicFrame() {
  const id = useId()
  const bronze = `url(#${id}bronze)`
  return (
    <svg className="epic-frame" viewBox="0 0 100 143" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}bronze`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--frame-1)' }} />
          <stop offset="0.3" style={{ stopColor: 'var(--frame-2)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--frame-3)' }} />
          <stop offset="0.78" style={{ stopColor: 'var(--frame-4)' }} />
          <stop offset="1" style={{ stopColor: 'var(--frame-5)' }} />
        </linearGradient>
      </defs>
      <path d="M7 0.6 H93 L99.4 7 V136 L93 142.4 H7 L0.6 136 V7 Z" fill="none" stroke={bronze} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
      <path
        d="M9 2.8 H40 L42 4.2 H58 L60 2.8 H91 L97.2 9 V134 L91 140.2 H9 L2.8 134 V9 Z"
        fill="none"
        stroke={bronze}
        strokeWidth="0.9"
        strokeOpacity="0.85"
        vectorEffect="non-scaling-stroke"
      />
      <g stroke={bronze} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke">
        <path d="M2.8 16 V9 L9 2.8 H17" vectorEffect="non-scaling-stroke" />
        <path d="M83 2.8 H91 L97.2 9 V16" vectorEffect="non-scaling-stroke" />
        <path d="M2.8 127 V134 L9 140.2 H17" vectorEffect="non-scaling-stroke" />
        <path d="M83 140.2 H91 L97.2 134 V127" vectorEffect="non-scaling-stroke" />
      </g>
      <path
        d="M33 143 V132.4 L36 129.4 H64 L67 132.4 V143 Z"
        style={{ fill: 'var(--tunnel-3)' }}
        fillOpacity="0.92"
        stroke={bronze}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** One to five stars from the card rating. */
function starsFor(rating: number | null) {
  if (rating == null) return 0
  return rating >= 95 ? 5 : rating >= 88 ? 4 : rating >= 80 ? 3 : rating >= 72 ? 2 : 1
}

type CollectibleProps = {
  league: League
  /** The player's numbers for the week, or null for an empty "up for grabs" card. */
  row: Row | null
  caption: string
  mini?: boolean
  to?: string
  /** Shows this figure instead of the player's saved one (used for previews); null shows none. */
  figureUrl?: string | null
}

/** An eFootball 2026 Epic-style player card with the player's figure, photo or initials, rating and weekly stats. */
export function CollectibleCard({ league, row, caption, mini = false, to, figureUrl }: CollectibleProps) {
  const ref = useRef<HTMLElement>(null)
  const tilt = useTilt(ref)
  const onScreen = useOnScreen(ref, !mini)
  const [broken, setBroken] = useState(false)
  const [figureBroken, setFigureBroken] = useState(false)
  const id = row?.playerId
  const player = id ? league.byId.get(id) : undefined
  const color = id ? league.colorOf(id) : '#3b4566'
  const photo = player?.avatar_url && !broken ? player.avatar_url : null
  const figure = figureUrl !== undefined ? figureUrl : player?.card_url && !figureBroken ? player.card_url : null
  const name = player?.name ?? 'Up for grabs'
  const rating = row ? cardRating(row) : null
  const stats = [
    { label: 'Goals', value: row?.gf },
    { label: 'Wins', value: row?.won },
    { label: mini ? 'CS' : 'Clean sheets', value: row?.cleanSheets },
  ]

  const stars = starsFor(rating)

  const inner = (
    <div className="epic-clip" aria-hidden>
      {mini ? <StillTunnel empty={!row} /> : <LiveTunnel empty={!row} active={onScreen} />}
      <div className="epic-shade" />
      <div className="epic-content">
        <div className="potw-card-top">
          <div>
            <div className="potw-rating">{rating ?? '??'}</div>
            <div className="potw-position">POTW</div>
          </div>
          <Crown className="potw-award-icon" />
        </div>
        <div className="potw-card-art">
          {figure ? (
            <img className="potw-figure" src={figure} alt="" onError={() => setFigureBroken(true)} />
          ) : (
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
          )}
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
      <EpicFrame />
      <div className="epic-plate">
        <div className="epic-chips">
          <span className="epic-chip">
            <Crown />
          </span>
          <span className="epic-chip">
            <Flame />
          </span>
        </div>
        <div className="epic-stars">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={`epic-star ${i < stars ? '' : 'is-dim'}`}>
              ★
            </span>
          ))}
        </div>
      </div>
      <svg className="epic-logo" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <polygon points="12,7.4 15.6,10 14.2,14.2 9.8,14.2 8.4,10" fill="currentColor" />
      </svg>
    </div>
  )

  const className = `potw-card ${mini ? 'is-mini' : ''} ${row ? '' : 'is-empty'}`
  const label = row ? `${name}: ${caption}, card rating ${rating}, ${stars} stars` : 'Player of the Week card: up for grabs'
  if (!to) {
    return (
      <div ref={ref as RefObject<HTMLDivElement>} className={className} role="img" aria-label={label}>
        {inner}
      </div>
    )
  }
  return (
    <Link
      to={to}
      ref={ref as RefObject<HTMLAnchorElement>}
      className={className}
      aria-label={label}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
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
          caption={featured && !qualified ? 'Race leader' : 'Player of the week'}
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
