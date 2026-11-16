import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { League } from '../lib/queries'
import type { Row } from '../lib/stats'
import { BallLogo } from './ui'
import './walkout.css'

/*
 * A pack-opening style reveal in seven beats: the logo spins, the player walks out of a neon
 * tunnel as a silhouette, the stadium lights up with a banner and flickers through colours,
 * clues appear one at a time (ending with the rating counting up), a glowing portal shows the
 * silhouette backlit, a white flash, then the reveal: name stripes, flames, the player's figure,
 * and their card flying in. Tap to skip to the reveal.
 */

const BEATS = [
  ['logo', 900],
  ['tunnel', 2300],
  ['stadium', 1800],
  ['clues', 2000],
  ['portal', 1600],
  ['flash', 500],
  ['reveal', 0],
] as const
type Beat = (typeof BEATS)[number][0]

/** A plain player silhouette, for players without a cut-out figure. */
const STAND_IN = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 220"><circle cx="50" cy="26" r="17"/><path d="M22 52 Q50 40 78 52 L88 118 L76 120 L70 84 L68 150 L64 216 L52 216 L50 150 L48 216 L36 216 L32 150 L30 84 L24 120 L12 118 Z"/></svg>',
)}`

function Count({ to, ms }: { to: number; ms: number }) {
  const [n, setN] = useState(Math.max(40, to - 30))
  useEffect(() => {
    const from = Math.max(40, to - 30)
    const started = performance.now()
    let frame = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - started) / ms)
      setN(Math.round(from + (to - from) * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to, ms])
  return <>{n}</>
}

type Props = {
  league: League
  row: Row
  /** The card that flies in at the end. */
  card: ReactNode
  rating: number | null
  /** What the stadium banner says, e.g. "Player of the Month". */
  banner: string
  /** Clues before the rating, e.g. ["Oct", "POTM"]. */
  clues: string[]
  /** Under the name at the end, e.g. "121 points · 23W 3D 12L". */
  line: string
}

export function Walkout({ league, row, card, rating, banner, clues, line }: Props) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [beat, setBeat] = useState<Beat>(reduced ? 'reveal' : 'logo')
  const celebrated = useRef(false)
  const player = league.byId.get(row.playerId)
  const figure = player?.card_url ?? null
  const name = player?.name ?? league.nameOf(row.playerId)

  // Step through the beats.
  useEffect(() => {
    const i = BEATS.findIndex(([b]) => b === beat)
    const [, ms] = BEATS[i]
    if (!ms) return
    const t = window.setTimeout(() => setBeat(BEATS[i + 1][0]), ms)
    return () => window.clearTimeout(t)
  }, [beat])

  // Confetti when the card lands.
  useEffect(() => {
    if (beat !== 'reveal' || celebrated.current || reduced) return
    celebrated.current = true
    void import('canvas-confetti').then(({ default: confetti }) => {
      const colors = ['#ff8a1c', '#ffb052', '#ffd77a', '#fff1c4', '#d01818']
      window.setTimeout(() => confetti({ particleCount: 150, spread: 90, startVelocity: 44, origin: { y: 0.5 }, colors, zIndex: 70 }), 500)
    })
  }, [beat, reduced])

  const on = (b: Beat) => `walkout-layer walkout-${b} ${beat === b ? 'is-on' : ''}`
  const silhouette = figure ?? STAND_IN
  const stripe = `${name} · `.repeat(12)

  return (
    <div
      className={`walkout ${figure ? '' : 'is-solo'}`}
      // Taps skip to the reveal; after that they move the story on as usual.
      onPointerDown={(e) => beat !== 'reveal' && e.stopPropagation()}
      onPointerUp={(e) => {
        if (beat === 'reveal') return
        e.stopPropagation()
        setBeat('reveal')
      }}
      aria-label={beat === 'reveal' ? `${banner}: ${name}` : `Revealing the ${banner}. Tap to skip.`}
      aria-live="polite"
    >
      {beat === 'logo' && (
        <div className={on('logo')}>
          <BallLogo />
        </div>
      )}

      {beat === 'tunnel' && (
        <div className={on('tunnel')}>
          <div className="walkout-floor" />
          {['#ff3dc8', '#a855f7', '#ff3dc8', '#7c3aed', '#ff6ad5'].map((c, i) => (
            <span key={i} className="walkout-bar" style={{ top: `${12 + i * 13}%`, '--bar': c, animationDelay: `${-i * 0.27}s` } as CSSProperties} />
          ))}
          <img className="walkout-silhouette" src={silhouette} alt="" />
        </div>
      )}

      {beat === 'stadium' && (
        <div className={on('stadium')}>
          <div className="walkout-arch" />
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="walkout-spark" style={{ left: `${6 + ((i * 37) % 88)}%`, animationDelay: `${-((i * 0.13) % 1.1)}s` }} />
          ))}
          <div className="walkout-banner">{banner}</div>
        </div>
      )}

      {beat === 'clues' && (
        <div className={on('clues')}>
          {clues.map((c, i) => (
            <div key={c} className="walkout-clue" style={{ '--n': i } as CSSProperties}>
              {c}
            </div>
          ))}
          <div className="walkout-clue" style={{ '--n': clues.length } as CSSProperties}>
            {rating != null ? <Count to={rating} ms={900} /> : '??'}
          </div>
        </div>
      )}

      {beat === 'portal' && (
        <div className={on('portal')}>
          <div className="walkout-ring">
            <div className="walkout-mist" />
            <img className="walkout-portal-figure" src={silhouette} alt="" />
            <svg viewBox="0 0 200 200" aria-hidden>
              <defs>
                <path id="walkout-ring-path" d="M100 100 m-88 0 a88 88 0 1 1 176 0 a88 88 0 1 1 -176 0" />
              </defs>
              <circle cx="100" cy="100" r="88" fill="none" stroke="#111" strokeWidth="14" />
              <circle cx="100" cy="100" r="95" fill="none" stroke="#fff" strokeWidth="1.4" />
              <circle cx="100" cy="100" r="81" fill="none" stroke="#fff" strokeWidth="1.4" />
              <text fill="#fff" fontSize="9" fontWeight="800" letterSpacing="1.5" fontStyle="italic">
                <textPath href="#walkout-ring-path">{`${banner.toUpperCase()} · `.repeat(4)}</textPath>
              </text>
            </svg>
            <svg className="walkout-arc" viewBox="0 0 200 200" aria-hidden>
              {[
                'M8 70 L18 76 L12 84 L22 92 L14 100',
                'M192 120 L182 114 L188 106 L178 98 L186 90',
                'M30 30 L40 38 L34 44 L44 52',
                'M170 170 L160 162 L166 156 L156 148',
              ].map((d) => (
                <path key={d} d={d} fill="none" stroke="#5ef3ff" strokeWidth="2" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px #5ef3ff)' }} />
              ))}
            </svg>
          </div>
        </div>
      )}

      {beat === 'flash' && <div className={on('flash')} />}

      {beat === 'reveal' && (
        <div className={on('reveal')}>
          <div className="walkout-stripes" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="walkout-stripe">
                <span>
                  {stripe}
                  {stripe}
                </span>
              </div>
            ))}
          </div>
          <div className="walkout-beams" />
          <span className="walkout-flame" style={{ left: '-6%' }} />
          <span className="walkout-flame" style={{ right: '-6%', animationDelay: '-0.25s' }} />
          {figure && <img className="walkout-figure" src={figure} alt="" />}
          <div className="walkout-card">{card}</div>
          <div className="walkout-name">
            {name}
            <small>{line}</small>
          </div>
        </div>
      )}

      {beat !== 'reveal' && <span className="walkout-skip">Tap to skip</span>}
    </div>
  )
}
