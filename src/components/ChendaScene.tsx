import { useId, type ReactNode } from 'react'
import './chenda.css'

/*
 * The chenda card: the week's last-placed player stands behind a Kerala chenda like a
 * melam performer, in front of a golden nettipattam (the Pooram elephant's headdress),
 * while two sticks beat the drum. Drawn in the card's 100 x 143 grid, in three layers:
 * the scene behind the player, the player, and the drum and sticks in front.
 */

// The drum head at the player's waist, where each stick lands on it, and the drum's foot (below the card).
const HEAD = { x: 50, y: 87, rx: 27, ry: 7 }
const FOOT = 152
// Each stick is a curved cane held from off the card (its pivot, where chenda.css turns it),
// so swinging it moves the tip up and down across the player's chest, never the face.
const SIDES = {
  left: { hit: { x: 41.5, y: 87.4 }, stick: 'M-18 99 Q10 80 41.5 87.4' },
  right: { hit: { x: 58.5, y: 87 }, stick: 'M118 95 Q88 78 58.5 87' },
} as const

// The nettipattam: rows of gold bosses on red velvet, wide at the top and tapering to a point,
// with a column of bigger bosses down the middle.
const NETTI = { top: 22, rows: 13, gap: 5.4, half: 32, tip: 99 }

type Disc = { x: number; y: number; r: number; row: number }

function nettipattam() {
  const discs: Disc[] = []
  const left: string[] = []
  const right: string[] = []
  const step = 5.2
  for (let row = 0; row < NETTI.rows; row++) {
    const t = row / (NETTI.rows - 1)
    const half = NETTI.half * (1 - t ** 1.4)
    const y = NETTI.top + 3.2 + row * NETTI.gap
    // Alternate rows sit between the bosses above them, like scales.
    const count = row % 2 === 0 ? 2 * Math.floor(half / step) + 1 : Math.max(1, 2 * Math.floor((half + step / 2) / step))
    const r = 1.95 - t * 0.6
    for (let k = 0; k < count; k++) {
      const middle = count % 2 === 1 && k === (count - 1) / 2
      discs.push({ x: 50 + (k - (count - 1) / 2) * step, y, r: middle ? r * 1.35 : r, row })
    }
    left.push(`${(50 - half - 3).toFixed(2)},${y.toFixed(2)}`)
    right.unshift(`${(50 + half + 3).toFixed(2)},${y.toFixed(2)}`)
  }
  const [firstLeft] = left
  const lastRight = right[right.length - 1]
  const outline = `M${firstLeft} Q50 ${NETTI.top - 4} ${lastRight} L${right.slice(0, -1).reverse().join(' L')} L50,${NETTI.tip} L${left.slice(1).reverse().join(' L')} Z`
  return { discs, outline }
}

const NETTI_SHAPE = nettipattam()

/** The rope lacing: a zigzag round the front of the drum, from the head down past the card's edge. */
function lacing() {
  const points: string[] = []
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / steps
    const x = HEAD.x + (HEAD.rx + 0.3) * Math.sin(angle)
    const y = (i % 2 ? FOOT - 6 : HEAD.y + 2) + HEAD.ry * 0.9 * Math.cos(angle)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return points.join(' ')
}

// Twinkling festival lights round the edge: x, y, delay.
const LIGHTS = [
  [8, 34, -0.9], [92, 32, -0.2], [6, 52, -1.6], [94, 50, -0.7], [9, 70, -1.5], [91, 68, -0.6],
  [14, 18, -1.1], [86, 18, -0.4],
] as const

// Embers rising off the drum: x, size, seconds to rise, delay, sideways drift.
const EMBERS = [
  [24, 0.7, 4.2, -0.3, -6], [31, 0.5, 3.6, -2.1, 4], [38, 0.8, 4.8, -1.2, -3], [45, 0.5, 3.9, -3.3, 5],
  [55, 0.6, 4.4, -0.8, -5], [62, 0.8, 3.7, -2.6, 3], [69, 0.5, 4.6, -1.7, 6], [76, 0.7, 4.1, -3.6, -4],
  [18, 0.5, 5.2, -4.1, 3], [82, 0.6, 5, -0.5, -3],
] as const

type Props = {
  /** The player: their cut-out figure, or their round photo. */
  performer: ReactNode
  /** A round photo (or initials) rather than a cut-out figure, which sits higher and smaller. */
  photo: boolean
}

export function ChendaScene({ performer, photo }: Props) {
  const id = useId()
  const url = (name: string) => `url(#${id}${name})`
  const body = `M${HEAD.x - HEAD.rx} ${HEAD.y} V${FOOT} H${HEAD.x + HEAD.rx} V${HEAD.y} Z`
  const sides = ['left', 'right'] as const

  return (
    <>
      <svg className="chenda-scene chenda-back" viewBox="0 0 100 143" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id={`${id}bg`} cx="50%" cy="38%" r="78%">
            <stop offset="0" stopColor="#b8301c" />
            <stop offset="0.42" stopColor="#5e110a" />
            <stop offset="1" stopColor="#150302" />
          </radialGradient>
          <radialGradient id={`${id}glow`}>
            <stop offset="0" stopColor="#ffd08a" stopOpacity="0.75" />
            <stop offset="0.45" stopColor="#ff8a3d" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}velvet`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7d140c" />
            <stop offset="1" stopColor="#3d0705" />
          </linearGradient>
          <radialGradient id={`${id}gold`} cx="38%" cy="32%" r="70%">
            <stop offset="0" stopColor="#fff2c2" />
            <stop offset="0.45" stopColor="#f2c25a" />
            <stop offset="1" stopColor="#8a5414" />
          </radialGradient>
        </defs>

        <rect width="100" height="143" fill={url('bg')} />
        <g className="chenda-rays chenda-anim">
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d="M50 42 L46 -70 L54 -70 Z" transform={`rotate(${(i * 360) / 14} 50 42)`} />
          ))}
        </g>

        <g className="chenda-netti">
          <path d={NETTI_SHAPE.outline} fill={url('velvet')} stroke="#e9b44f" strokeWidth="0.7" strokeLinejoin="round" />
          <path d={`M43 ${NETTI.top - 1} A7.5 7.5 0 0 0 57 ${NETTI.top - 1} A6.2 5.2 0 0 1 43 ${NETTI.top - 1} Z`} fill={url('gold')} />
          {NETTI_SHAPE.discs.map((d, i) => (
            <g key={i}>
              <circle cx={d.x} cy={d.y} r={d.r} fill={url('gold')} />
              <circle
                cx={d.x - d.r * 0.32}
                cy={d.y - d.r * 0.32}
                r={d.r * 0.42}
                className="chenda-glint chenda-anim"
                style={{ animationDelay: `${(d.row * 0.1 - 2.6).toFixed(2)}s` }}
              />
            </g>
          ))}
        </g>

        {sides.map((side) => (
          <circle key={side} cx={HEAD.x} cy={HEAD.y} r="22" className={`chenda-ring chenda-anim is-${side}`} />
        ))}
        <circle cx={HEAD.x} cy={HEAD.y} r="40" fill={url('glow')} className="chenda-glow chenda-anim" />

        {LIGHTS.map(([x, y, delay], i) => (
          <circle key={i} cx={x} cy={y} r="1.1" className="chenda-light chenda-anim" style={{ animationDelay: `${delay}s` }} />
        ))}
        {EMBERS.map(([x, r, seconds, delay, drift], i) => (
          <circle
            key={i}
            cx={x}
            cy={96}
            r={r}
            className="chenda-ember chenda-anim"
            style={{ animationDuration: `${seconds}s`, animationDelay: `${delay}s`, ['--drift' as string]: `${drift}px` }}
          />
        ))}
      </svg>

      <div className={`chenda-performer chenda-anim ${photo ? 'is-photo' : ''}`}>
        <div className="chenda-performer-body chenda-anim">{performer}</div>
      </div>

      <svg className="chenda-scene chenda-front" viewBox="0 0 100 143" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${id}wood`} x1="0" x2="1">
            <stop offset="0" stopColor="#2a1206" />
            <stop offset="0.2" stopColor="#6b3816" />
            <stop offset="0.42" stopColor="#b5793c" />
            <stop offset="0.52" stopColor="#c58a4a" />
            <stop offset="0.75" stopColor="#6b3816" />
            <stop offset="1" stopColor="#210d04" />
          </linearGradient>
          <radialGradient id={`${id}skin`} cx="50%" cy="38%" r="70%">
            <stop offset="0" stopColor="#fbf0d4" />
            <stop offset="0.6" stopColor="#e6c991" />
            <stop offset="1" stopColor="#a47c45" />
          </radialGradient>
          <linearGradient id={`${id}stick`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f6d9a6" />
            <stop offset="1" stopColor="#b5834a" />
          </linearGradient>
          <clipPath id={`${id}head`}>
            <ellipse cx={HEAD.x} cy={HEAD.y} rx={HEAD.rx} ry={HEAD.ry} />
          </clipPath>
        </defs>

        <g className="chenda-drum chenda-anim">
          <path d={body} fill={url('wood')} />
          <path d={`M${HEAD.x - 9} ${HEAD.y + 6} V${FOOT}`} stroke="#fff" strokeOpacity="0.1" strokeWidth="3" />
          <path d={`M${HEAD.x - HEAD.rx} 101 A${HEAD.rx} ${HEAD.ry} 0 0 0 ${HEAD.x + HEAD.rx} 101`} fill="none" stroke="#e0a53f" strokeWidth="1.6" />
          <path d={`M${HEAD.x - HEAD.rx} 104.5 A${HEAD.rx} ${HEAD.ry} 0 0 0 ${HEAD.x + HEAD.rx} 104.5`} fill="none" stroke="#a51d13" strokeWidth="2.2" />
          <polyline points={lacing()} fill="none" stroke="#f4e4c1" strokeWidth="0.5" strokeLinejoin="round" opacity="0.72" />
          <ellipse cx={HEAD.x} cy={HEAD.y} rx={HEAD.rx + 1.6} ry={HEAD.ry + 1.5} fill="#241004" stroke="#c98a2e" strokeWidth="0.7" />
          <g className="chenda-head chenda-anim">
            <ellipse cx={HEAD.x} cy={HEAD.y} rx={HEAD.rx} ry={HEAD.ry} fill={url('skin')} />
            <ellipse cx={HEAD.x} cy={HEAD.y + 0.3} rx={HEAD.rx * 0.4} ry={HEAD.ry * 0.4} fill="#b08a55" opacity="0.32" />
            <g clipPath={url('head')}>
              {sides.map((side) => (
                <ellipse
                  key={side}
                  cx={SIDES[side].hit.x}
                  cy={SIDES[side].hit.y}
                  rx="6"
                  ry="1.6"
                  className={`chenda-ripple chenda-anim is-${side}`}
                  style={{ transformOrigin: `${SIDES[side].hit.x}px ${SIDES[side].hit.y}px` }}
                />
              ))}
            </g>
          </g>
        </g>

        {sides.map((side) => {
          const { x, y } = SIDES[side].hit
          return (
            <g key={side} className={`chenda-burst chenda-anim is-${side}`} style={{ transformOrigin: `${x}px ${y}px` }}>
              {[-160, -130, -100, -70, -40, -15].map((deg) => {
                const a = (deg * Math.PI) / 180
                return <line key={deg} x1={x + 3 * Math.cos(a)} y1={y + 3 * Math.sin(a)} x2={x + 7 * Math.cos(a)} y2={y + 7 * Math.sin(a)} />
              })}
            </g>
          )
        })}

        {sides.map((side) => (
          <g key={side} className={`chenda-stick chenda-anim is-${side}`}>
            <path d={SIDES[side].stick} stroke="#3a200c" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d={SIDES[side].stick} stroke={url('stick')} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
        ))}
      </svg>
    </>
  )
}
