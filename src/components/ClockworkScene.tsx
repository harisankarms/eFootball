import { useId, type CSSProperties } from 'react'
import './clockwork.css'

/*
 * The Player of the Month background: glowing orange clockwork on a tilted plane, with gear
 * rings turning at different speeds, light running round the rims, beaded chains, a smoky haze
 * and rising embers. Every moving part is a flat layer turned by CSS, so phones keep it smooth.
 */

const C = 100
const f = (n: number) => n.toFixed(1)

/** Short radial bars (gear teeth, dial blocks) between radius `r` and `r + len`. */
function radialBars(r: number, count: number, len: number, width: number, start = 0) {
  let d = ''
  for (let i = 0; i < count; i++) {
    const a = start + (i / count) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const px = (-sa * width) / 2
    const py = (ca * width) / 2
    const x1 = C + ca * r
    const y1 = C + sa * r
    const x2 = C + ca * (r + len)
    const y2 = C + sa * (r + len)
    d += `M${f(x1 + px)} ${f(y1 + py)}L${f(x2 + px)} ${f(y2 + py)}L${f(x2 - px)} ${f(y2 - py)}L${f(x1 - px)} ${f(y1 - py)}Z`
  }
  return d
}

/** A cog's outline: `teeth` flat-topped teeth between radius `inner` and `outer`. */
function cogPath(inner: number, outer: number, teeth: number) {
  const pts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const step = (Math.PI * 2) / teeth
    for (const [da, r] of [
      [0, inner],
      [step * 0.12, outer],
      [step * 0.45, outer],
      [step * 0.57, inner],
    ] as const)
      pts.push(`${f(C + Math.cos(a + da) * r)} ${f(C + Math.sin(a + da) * r)}`)
  }
  return `M${pts.join('L')}Z`
}

type PartKind = 'ring' | 'dial' | 'cog' | 'bars'
/** Where a part goes when the whole scene is drawn as one picture (see ClockworkStill). */
type Box = { x: number; y: number; width: number; height: number }

function PartArt({ kind, id, box }: { kind: PartKind; id: string; box?: Box }) {
  const glow = `url(#${id}g)`
  const defs = (
    <defs>
      <filter id={`${id}g`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4.5" />
      </filter>
      <radialGradient id={`${id}m`} cx="45%" cy="40%" r="65%">
        <stop offset="0" stopColor="#c8400c" stopOpacity="0.55" />
        <stop offset="1" stopColor="#6a1405" stopOpacity="0.6" />
      </radialGradient>
    </defs>
  )
  if (kind === 'ring') {
    const teeth = radialBars(80, 56, 18, 6.2)
    return (
      <svg viewBox="0 0 200 200" aria-hidden {...box}>
        {defs}
        <g filter={glow}>
          <circle cx={C} cy={C} r="76" fill="none" stroke="#ff5200" strokeWidth="26" />
          <path d={teeth} fill="#ff6a0a" />
        </g>
        <circle cx={C} cy={C} r="76" fill="none" stroke="#ff9a24" strokeWidth="11" />
        <circle cx={C} cy={C} r="76" fill="none" stroke="#ffe49a" strokeWidth="4.2" />
        <circle cx={C} cy={C} r="66" fill="none" stroke="#ff8a2a" strokeWidth="2" strokeDasharray="2 3" />
        <path d={teeth} fill="#ffb440" />
      </svg>
    )
  }
  if (kind === 'dial') {
    const blocks = radialBars(54, 14, 30, 13, Math.PI / 14)
    const ticks = radialBars(44, 56, 5, 1.6)
    return (
      <svg viewBox="0 0 200 200" aria-hidden {...box}>
        {defs}
        <g filter={glow}>
          <path d={blocks} fill="none" stroke="#ff4600" strokeWidth="13" />
          <circle cx={C} cy={C} r="92" fill="none" stroke="#ff5200" strokeWidth="9" />
        </g>
        <path d={blocks} fill="rgb(255 110 30 / 0.22)" stroke="#ffa83a" strokeWidth="4.6" strokeLinejoin="round" />
        <circle cx={C} cy={C} r="92" fill="none" stroke="#ffc878" strokeWidth="2.6" />
        <circle cx={C} cy={C} r="96" fill="none" stroke="#ff8a30" strokeWidth="1.4" strokeDasharray="1.5 4" />
        <path d={ticks} fill="#ffb048" />
        <circle cx={C} cy={C} r="42" fill="none" stroke="#ff9a36" strokeWidth="2" />
      </svg>
    )
  }
  if (kind === 'cog') {
    const outline = cogPath(70, 88, 12)
    return (
      <svg viewBox="0 0 200 200" aria-hidden {...box}>
        {defs}
        <path d={outline} fill="none" stroke="#ff4a00" strokeWidth="10" filter={glow} />
        <path d={outline} fill={`url(#${id}m)`} stroke="#ffa040" strokeWidth="3" strokeLinejoin="round" />
        <circle cx={C} cy={C} r="52" fill="none" stroke="#ff8a30" strokeWidth="3" />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2
          return (
            <line
              key={i}
              x1={f(C + Math.cos(a) * 18)}
              y1={f(C + Math.sin(a) * 18)}
              x2={f(C + Math.cos(a) * 52)}
              y2={f(C + Math.sin(a) * 52)}
              stroke="#ff7a20"
              strokeWidth="5"
              strokeLinecap="round"
            />
          )
        })}
        <circle cx={C} cy={C} r="18" fill="#7a1a06" stroke="#ffb050" strokeWidth="3" />
      </svg>
    )
  }
  // A row of glowing bars, like lit panels along a rail.
  return (
    <svg viewBox="0 0 200 40" aria-hidden {...box}>
      {defs}
      <g filter={glow}>
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={6 + i * 21.5} y="11" width="13" height="18" rx="2" fill="#ff5000" />
        ))}
      </g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={6 + i * 21.5} y="11" width="13" height="18" rx="2" fill="#ffb048" stroke="#ffe0a8" strokeWidth="1" />
      ))}
    </svg>
  )
}

/** Light running round a rim: a short bright arc turning faster than its ring. */
function Sweep({ id, box }: { id: string; box?: Box }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden {...box}>
      <defs>
        <filter id={`${id}s`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle cx={C} cy={C} r="77" fill="none" stroke="#ffb848" strokeWidth="12" strokeDasharray="70 414" filter={`url(#${id}s)`} />
      <circle cx={C} cy={C} r="77" fill="none" stroke="#fff6dc" strokeWidth="3" strokeDasharray="56 428" strokeLinecap="round" />
    </svg>
  )
}

/** A beaded chain: a line of dots that creeps along. */
function Chain({ box }: { box?: Box }) {
  return (
    <svg viewBox="0 0 400 10" preserveAspectRatio="none" aria-hidden {...box}>
      <line className="clock-chain-dots" x1="0" y1="5" x2="400" y2="5" stroke="#ff9a3a" strokeWidth="4.5" strokeDasharray="0.1 9" strokeLinecap="round" />
    </svg>
  )
}

type Part = { kind: PartKind | 'sweep' | 'chain'; x: number; y: number; size: number; turn: number; start?: number; reverse?: boolean }

// Positions on the plane (percent of its width), sizes, and seconds per turn (0 = still).
const PARTS: Part[] = [
  { kind: 'dial', x: 24, y: 66, size: 48, turn: 40, start: 10 },
  { kind: 'chain', x: 50, y: 34, size: 120, turn: 0, start: 4 },
  { kind: 'chain', x: 50, y: 57, size: 120, turn: 0, start: -3 },
  { kind: 'chain', x: 50, y: 90, size: 120, turn: 0, start: 2 },
  { kind: 'ring', x: 20, y: 22, size: 32, turn: 16, reverse: true },
  { kind: 'sweep', x: 20, y: 22, size: 32, turn: 3.2 },
  { kind: 'ring', x: 50, y: 15, size: 24, turn: 13 },
  { kind: 'ring', x: 80, y: 30, size: 32, turn: 18, reverse: true },
  { kind: 'sweep', x: 80, y: 30, size: 32, turn: 3.6, reverse: true },
  { kind: 'cog', x: 38, y: 36, size: 15, turn: 8 },
  { kind: 'cog', x: 10, y: 46, size: 13, turn: 7, reverse: true },
  { kind: 'ring', x: 58, y: 46, size: 32, turn: 14 },
  { kind: 'sweep', x: 58, y: 46, size: 32, turn: 2.8 },
  { kind: 'cog', x: 90, y: 56, size: 17, turn: 9, reverse: true },
  { kind: 'ring', x: 50, y: 70, size: 20, turn: 9 },
  { kind: 'ring', x: 32, y: 50, size: 22, turn: 12, reverse: true },
  { kind: 'ring', x: 66, y: 22, size: 18, turn: 10 },
  { kind: 'ring', x: 88, y: 72, size: 22, turn: 15, reverse: true },
  { kind: 'ring', x: 60, y: 92, size: 26, turn: 17 },
  { kind: 'ring', x: 76, y: 78, size: 42, turn: 22, reverse: true },
  { kind: 'sweep', x: 76, y: 78, size: 42, turn: 4, reverse: true },
  { kind: 'cog', x: 42, y: 86, size: 17, turn: 10, reverse: true },
  { kind: 'ring', x: 94, y: 94, size: 24, turn: 12 },
  { kind: 'ring', x: 8, y: 92, size: 22, turn: 11, reverse: true },
  { kind: 'bars', x: 64, y: 8, size: 32, turn: 0, start: -8 },
  { kind: 'bars', x: 94, y: 14, size: 22, turn: 0, start: -8 },
  { kind: 'bars', x: 26, y: 96, size: 26, turn: 0, start: 6 },
]

const EMBERS = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: -((i * 0.83) % 5),
  duration: 3.6 + ((i * 7) % 5) * 0.5,
  size: 0.9 + ((i * 3) % 4) * 0.35,
}))

/**
 * The same scene as one still picture (for share images): the plane's tilt drawn flat, the
 * parts where the moving scene has them, a few embers frozen mid-air. 1000 x 1430, like a card.
 */
export function ClockworkStill() {
  const id = useId().replace(/:/g, '')
  const W = 1000
  const H = 1430
  const plane = W * 1.75
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="42%" r="78%">
          <stop offset="0" stopColor="#c8340a" />
          <stop offset="0.3" stopColor="#961a07" />
          <stop offset="0.62" stopColor="#5c0c06" />
          <stop offset="1" stopColor="#2a0408" />
        </radialGradient>
        {[
          ['h5', '#601650', 0.5],
          ['h1', '#3c0402', 0.5],
          ['h2', '#460602', 0.5],
          ['h3', '#ff9632', 0.14],
          ['h4', '#ff8c28', 0.12],
          ['glow', '#ff8a3a', 0.25],
        ].map(([key, color, alpha]) => (
          <radialGradient key={key} id={`${id}${key}`}>
            <stop offset="0" stopColor={color as string} stopOpacity={alpha} />
            <stop offset="1" stopColor={color as string} stopOpacity="0" />
          </radialGradient>
        ))}
        <filter id={`${id}e`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}bg)`} />
      <ellipse cx={W * 0.26} cy={H * 0.8} rx={W * 0.48} ry={H * 0.36} fill={`url(#${id}h5)`} />
      <ellipse cx={W * 0.22} cy={H * 0.62} rx={W * 0.42} ry={H * 0.31} fill={`url(#${id}h1)`} />
      <ellipse cx={W * 0.82} cy={H * 0.3} rx={W * 0.39} ry={H * 0.28} fill={`url(#${id}h2)`} />
      <ellipse cx={W * 0.7} cy={H * 0.62} rx={W * 0.5} ry={H * 0.36} fill={`url(#${id}h3)`} />
      <ellipse cx={W * 0.3} cy={H * 0.26} rx={W * 0.42} ry={H * 0.31} fill={`url(#${id}h4)`} />
      <g transform={`translate(${W / 2} ${H * 0.46}) rotate(33) scale(1 0.59) translate(${-plane / 2} ${-plane / 2})`}>
        {PARTS.map((p, i) => {
          const size = (p.size / 100) * plane
          const height = p.kind === 'bars' ? size / 5 : p.kind === 'chain' ? size / 40 : size
          const cx = (p.x / 100) * plane
          const cy = (p.y / 100) * plane
          const box = { x: cx - size / 2, y: cy - height / 2, width: size, height }
          return (
            <g key={i} transform={`rotate(${p.start ?? 0} ${cx} ${cy})`}>
              {p.kind === 'sweep' ? (
                <Sweep id={`${id}${i}`} box={box} />
              ) : p.kind === 'chain' ? (
                <Chain box={box} />
              ) : (
                <PartArt kind={p.kind} id={`${id}${i}`} box={box} />
              )}
            </g>
          )
        })}
      </g>
      <ellipse cx={W / 2} cy={H * 0.46} rx={W * 0.5} ry={H * 0.36} fill={`url(#${id}glow)`} />
      {EMBERS.map((e, i) => {
        const cx = (e.left / 100) * W
        const cy = H * (0.2 + ((i * 0.37) % 0.75))
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={e.size * 9} fill="#ff8828" opacity="0.8" filter={`url(#${id}e)`} />
            <circle cx={cx} cy={cy} r={e.size * 4} fill="#ffd38c" />
          </g>
        )
      })}
    </svg>
  )
}

export function ClockworkScene() {
  const id = useId().replace(/:/g, '')
  return (
    <div className="clock-scene" aria-hidden>
      <div className="clock-haze" />
      <div className="clock-stage">
        <div className="clock-plane">
          {PARTS.map((p, i) => (
            <div
              key={i}
              className={`clock-part is-${p.kind} ${p.turn ? 'is-turning' : ''}`}
              style={
                {
                  '--x': `${p.x}%`,
                  '--y': `${p.y}%`,
                  '--s': `${p.size}%`,
                  '--turn': `${p.turn}s`,
                  '--start': `${p.start ?? 0}deg`,
                  '--dir': p.reverse ? 'reverse' : 'normal',
                } as CSSProperties
              }
            >
              {p.kind === 'sweep' ? <Sweep id={`${id}${i}`} /> : p.kind === 'chain' ? <Chain /> : <PartArt kind={p.kind} id={`${id}${i}`} />}
            </div>
          ))}
        </div>
      </div>
      <div className="clock-glow" />
      <div className="clock-embers">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            style={
              {
                left: `${e.left}%`,
                '--size': `${e.size}cqi`,
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}
