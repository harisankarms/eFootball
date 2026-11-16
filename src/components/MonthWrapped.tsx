import { Footprints, Gamepad2, Medal, TrendingUp, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { League } from '../lib/queries'
import { ratings } from '../lib/rating'
import { newsworthy, recordBook } from '../lib/records'
import { formatPerGame, formatPoints, sideOf, winnerOf, type MonthResult, type Row } from '../lib/stats'
import { addMonths, monthCardLabel, monthLabel, startOfDay, weekKey } from '../lib/time'
import { Avatar } from './Avatar'
import { CollectibleCard } from './Potw'
import { RECORD_ICONS, breakSentence } from './Records'
import { AwardSlide, Count, Story, at, type Slide } from './Story'
import { StandingsTable } from './StandingsTable'
import { BallLogo, GlowIcon } from './ui'

const REVEAL_AFTER_MS = 2600

/** The Player of the Month card, face down: it charges up, bursts, and flips over. Tap it to flip early. */
export function CardReveal({ league, row, month }: { league: League; row: Row; month: string }) {
  return (
    <FaceDownCard
      title="Player of the Month"
      sub={monthLabel(month)}
      card={<CollectibleCard kind="potm" league={league} row={row} month={month} caption={monthCardLabel(month)} />}
      caption={
        <>
          <div className="recap-title">{league.nameOf(row.playerId)}</div>
          <div className="recap-sub mt-1">
            {formatPoints(row.points)} points · {row.won}W {row.drawn}D {row.lost}L · {row.gf} goals
          </div>
        </>
      }
    />
  )
}

/** Any card, face down: it charges up, bursts with a flash and confetti, and flips over. Tap to flip early. */
export function FaceDownCard({ title, sub, card, caption }: { title: string; sub: string; card: ReactNode; caption: ReactNode }) {
  const [phase, setPhase] = useState<'charging' | 'burst' | 'shown'>('charging')
  const started = useRef(false)

  const reveal = () => {
    if (started.current) return
    started.current = true
    setPhase('burst')
    window.setTimeout(() => setPhase('shown'), 380)
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      void import('canvas-confetti').then(({ default: confetti }) => {
        const colors = ['#ff8a1c', '#ffb052', '#ffd77a', '#fff1c4', '#e8641a']
        confetti({ particleCount: 140, spread: 85, startVelocity: 42, origin: { y: 0.45 }, colors, scalar: 1.05, zIndex: 70 })
        window.setTimeout(() => confetti({ particleCount: 70, spread: 120, startVelocity: 30, origin: { y: 0.4 }, colors, zIndex: 70 }), 250)
      })
    }
  }

  useEffect(() => {
    const t = window.setTimeout(reveal, REVEAL_AFTER_MS)
    return () => window.clearTimeout(t)
    // Once, when the slide appears.
  }, [])

  return (
    <div
      className={`reveal is-${phase}`}
      // Taps on the card flip it; they don't move the story on.
      onPointerDown={(e) => phase === 'charging' && e.stopPropagation()}
      onPointerUp={(e) => {
        if (phase !== 'charging') return
        e.stopPropagation()
        reveal()
      }}
    >
      <div className="reveal-rays" aria-hidden />
      <div className="reveal-slot">
        {phase !== 'shown' ? (
          <div className="reveal-back" role="button" aria-label={`Reveal the ${title}`}>
            <BallLogo />
            <div className="reveal-back-label">{title}</div>
            <div className="reveal-back-month">{sub}</div>
          </div>
        ) : (
          <div className="reveal-front">{card}</div>
        )}
        <div className="reveal-flash" aria-hidden />
      </div>
      {phase === 'shown' ? (
        <div className="reveal-caption text-center">{caption}</div>
      ) : (
        <div className="reveal-hint">Tap to reveal</div>
      )}
    </div>
  )
}

function buildMonthSlides(league: League, month: MonthResult): Slide[] {
  const { nameOf } = league
  const name = monthLabel(month.monthKey)
  const short = name.split(' ')[0]
  const a = month.awards
  const goals = month.matches.reduce((s, m) => s + m.home_goals + m.away_goals, 0)
  const players = new Set(month.matches.flatMap((m) => [m.home_id, m.away_id])).size
  const slides: Slide[] = []
  const monthShare = {
    name: `month-in-review-${month.monthKey}`,
    text: `${short} in review`,
    make: (p: import('./Story').Posters) => p.weekPoster(league, month, name, 'month'),
  }

  slides.push({
    key: 'intro',
    theme: 'potm',
    share: monthShare,
    body: (
      <>
        <div className="recap-pop" style={at(0)}>
          <BallLogo className="h-20 w-20 animate-float" />
        </div>
        <div className="recap-kicker recap-in" style={at(1)}>
          Month in review
        </div>
        <div className="recap-title recap-in" style={at(2)}>
          {short} wrapped
        </div>
        <div className="recap-tiles recap-in" style={at(3)}>
          <div className="recap-tile">
            <strong>
              <Count value={month.matches.length} />
            </strong>
            <span>Games</span>
          </div>
          <div className="recap-tile">
            <strong>
              <Count value={goals} />
            </strong>
            <span>Goals</span>
          </div>
          <div className="recap-tile">
            <strong>
              <Count value={players} />
            </strong>
            <span>Players</span>
          </div>
        </div>
      </>
    ),
  })

  if (month.winner) {
    const w = month.winner
    slides.push({
      key: 'reveal',
      theme: 'potm',
      ms: 10_000,
      share: {
        name: `player-of-the-month-${month.monthKey}`,
        text: `${nameOf(w.playerId)} is Player of the Month for ${name} 🏆`,
        make: (p) => p.cardPoster(league, { kind: 'potm', row: w, month: month.monthKey, caption: monthCardLabel(month.monthKey), subtitle: `${name} champion` }),
      },
      body: (
        <>
          <div className="recap-kicker recap-in" style={at(0)}>
            And the Player of the Month is…
          </div>
          <CardReveal league={league} row={w} month={month.monthKey} />
        </>
      ),
    })
  }

  if (a.goldenBoot) {
    const ids = a.goldenBoot.ids
    const detail = `${a.goldenBoot.goals} goals`
    slides.push({
      key: 'boot',
      theme: 'boot',
      share: {
        name: `top-scorer-${month.monthKey}`,
        text: `Top scorer in ${short}: ${ids.map(nameOf).join(' & ')}, ${detail}`,
        make: (p) => p.awardPoster(league, { icon: 'boot', first: 'Top', rest: 'scorer', subtitle: name, ids, detail }),
      },
      body: <AwardSlide league={league} icon={Footprints} tint="gold" label={`Top scorer in ${short}`} ids={ids} title={ids.map(nameOf).join(' & ')} detail={detail} />,
    })
  }

  // Biggest climb in the form rating over the month.
  const all = ratings(league.matches)
  const inMonth = new Set(month.matches.map((m) => m.id))
  const climbs = [...all.history.entries()]
    .map(([id, points]) => ({ id, change: points.filter((p) => inMonth.has(p.match.id)).reduce((s, p) => s + p.change, 0) }))
    .filter((c) => c.change > 0)
    .sort((x, y) => y.change - x.change)
  if (climbs[0]) {
    const c = climbs[0]
    const detail = `+${Math.round(c.change)} rating`
    slides.push({
      key: 'rating',
      theme: 'rating',
      share: {
        name: `form-of-the-month-${month.monthKey}`,
        text: `Form of the month (${short}): ${nameOf(c.id)}, ${detail}`,
        make: (p) => p.awardPoster(league, { icon: 'rating', first: 'Form', rest: 'of the month', subtitle: name, ids: [c.id], detail }),
      },
      body: <AwardSlide league={league} icon={TrendingUp} tint="accent" label="Form of the month" ids={[c.id]} title={nameOf(c.id)} detail={detail} />,
    })
  }

  const busiest = [...month.rows].sort((x, y) => y.played - x.played)[0]
  if (busiest) {
    const detail = `${busiest.played} games`
    slides.push({
      key: 'games',
      theme: 'games',
      share: {
        name: `most-games-${month.monthKey}`,
        text: `Never off the pitch in ${short}: ${nameOf(busiest.playerId)}, ${detail}`,
        make: (p) => p.awardPoster(league, { icon: 'games', first: 'Never off', rest: 'the pitch', subtitle: name, ids: [busiest.playerId], detail }),
      },
      body: <AwardSlide league={league} icon={Gamepad2} tint="cyan" label="Never off the pitch" ids={[busiest.playerId]} title={nameOf(busiest.playerId)} detail={detail} />,
    })
  }

  const big = a.biggestWin
  const bigWinner = big ? winnerOf(big) : null
  if (big && bigWinner) {
    const s = sideOf(big, bigWinner)
    slides.push({
      key: 'win',
      theme: 'win',
      share: { name: `biggest-win-${month.monthKey}`, text: `Biggest win of ${short}: ${nameOf(bigWinner)} ${s.gf}–${s.ga} ${nameOf(s.opponentId)}`, make: (p) => p.matchPoster(league, big) },
      body: (
        <>
          <div className="recap-pop" style={at(0)}>
            <GlowIcon icon={Zap} tint="accent" size="lg" />
          </div>
          <div className="recap-kicker recap-in" style={at(1)}>
            Biggest win of {short}
          </div>
          <div className="recap-pop flex items-center justify-center gap-4" style={at(2)}>
            <Avatar league={league} id={bigWinner} size={96} ring="gold" />
            <span className="recap-big">
              {s.gf}–{s.ga}
            </span>
            <Avatar league={league} id={s.opponentId} size={96} />
          </div>
          <div className="recap-title recap-in" style={at(3)}>
            {nameOf(bigWinner)}
          </div>
          <div className="recap-sub recap-in" style={at(4)}>
            against {nameOf(s.opponentId)}
          </div>
        </>
      ),
    })
  }

  if (a.chenda) {
    const c = a.chenda
    slides.push({
      key: 'chenda',
      theme: 'chenda',
      share: {
        name: `chenda-of-the-month-${month.monthKey}`,
        text: `${nameOf(c.playerId)} is the chenda of ${short} 🥁`,
        make: (p) => p.cardPoster(league, { kind: 'chenda', row: c, caption: name, subtitle: name, title: ['Chenda', 'of the month'] }),
      },
      body: (
        <>
          <div className="recap-kicker recap-in" style={at(0)}>
            Chenda of the month
          </div>
          <div className="recap-card recap-pop" style={at(1)}>
            <CollectibleCard kind="chenda" league={league} row={c} caption={name} />
          </div>
          <div className="recap-title recap-in" style={at(2)}>
            {nameOf(c.playerId)}
          </div>
          <div className="recap-sub recap-in" style={at(3)}>
            {formatPerGame(c)} points a game · {c.won}W {c.drawn}D {c.lost}L
          </div>
        </>
      ),
    })
  }

  const from = startOfDay(`${month.monthKey}-01`, league.tz).getTime()
  const to = startOfDay(`${addMonths(month.monthKey, 1)}-01`, league.tz).getTime()
  const broken = newsworthy(recordBook(league.matches, league.settings, weekKey(new Date(to), league.tz))).filter((b) => {
    const t = Date.parse(b.mark.at)
    return t >= from && t <= to
  })
  if (broken.length) {
    slides.push({
      key: 'records',
      theme: 'records',
      share: monthShare,
      body: (
        <>
          <div className="recap-pop" style={at(0)}>
            <GlowIcon icon={Medal} tint="violet" size="lg" />
          </div>
          <div className="recap-title recap-in" style={at(1)}>
            {broken.length === 1 ? 'A record fell' : `${broken.length} records fell`}
          </div>
          <div className="recap-list">
            {broken.slice(-4).map((b, i) => {
              const { icon, tint } = RECORD_ICONS[b.key]
              return (
                <div key={`${b.key}${b.mark.at}`} className="recap-row recap-in" style={at(i + 2)}>
                  <GlowIcon icon={icon} tint={tint} size="sm" />
                  <span className="text-sm leading-snug">{breakSentence(league, b)}</span>
                </div>
              )
            })}
          </div>
        </>
      ),
    })
  }

  slides.push({
    key: 'table',
    theme: 'table',
    share: {
      name: `table-${month.monthKey}`,
      text: `Final table, ${name}`,
      make: (p) => p.tablePoster(league, { rows: month.rows, first: 'Final', rest: 'table', subtitle: name, crownId: month.winner?.playerId, drumId: a.chenda?.playerId }),
    },
    body: (
      <>
        <div className="recap-kicker recap-in" style={at(0)}>
          Final table
        </div>
        <div className="recap-title recap-in" style={at(1)}>
          {name}
        </div>
        <div className="recap-in pointer-events-none w-full text-left" style={at(2)}>
          <StandingsTable league={league} rows={month.rows} crownId={month.winner?.playerId} drumId={a.chenda?.playerId} showQualification compact limit={6} />
        </div>
      </>
    ),
  })

  slides.push({
    key: 'outro',
    theme: 'outro',
    share: monthShare,
    body: (
      <>
        <div className="recap-pop" style={at(0)}>
          <BallLogo className="h-20 w-20" />
        </div>
        <div className="recap-title recap-in" style={at(1)}>
          That's {short}
        </div>
        <div className="recap-sub recap-in" style={at(2)}>
          A new month, a new race for the fiery card. Share {short} with the group, or get back on the pitch.
        </div>
      </>
    ),
  })
  return slides
}

/** A finished month as a story, with the Player of the Month card revealed. */
export function MonthWrapped({ league, month, onClose }: { league: League; month: MonthResult; onClose: () => void }) {
  const slides = useMemo(() => buildMonthSlides(league, month), [league, month])
  return <Story slides={slides} title={`Month in review, ${monthLabel(month.monthKey)}`} onClose={onClose} />
}
