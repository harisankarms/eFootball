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

function PartArt({ kind, id }: { kind: PartKind; id: string }) {
  const glow = `url(#${id}g)`
  const defs = (
    <defs>
      <filter id={`${id}g`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.2" />
      </filter>
      <radialGradient id={`${id}m`} cx="45%" cy="40%" r="65%">
        <stop offset="0" stopColor="#5a1d0a" />
        <stop offset="1" stopColor="#1a0604" />
      </radialGradient>
    </defs>
  )
  if (kind === 'ring') {
    const teeth = radialBars(80, 72, 11, 3.4)
    return (
      <svg viewBox="0 0 200 200" aria-hidden>
        {defs}
        <g filter={glow}>
          <circle cx={C} cy={C} r="76" fill="none" stroke="#ff7a00" strokeWidth="11" />
          <path d={teeth} fill="#ff8c10" />
        </g>
        <circle cx={C} cy={C} r="76" fill="none" stroke="#ffa526" strokeWidth="6" />
        <circle cx={C} cy={C} r="76" fill="none" stroke="#fff0bc" strokeWidth="1.8" />
        <circle cx={C} cy={C} r="66" fill="none" stroke="#ff9a2a" strokeWidth="1.6" strokeDasharray="2 3" />
        <path d={teeth} fill="#ffc444" />
      </svg>
    )
  }
  if (kind === 'dial') {
    const blocks = radialBars(54, 14, 30, 13, Math.PI / 14)
    const ticks = radialBars(44, 56, 5, 1.6)
    return (
      <svg viewBox="0 0 200 200" aria-hidden>
        {defs}
        <g filter={glow}>
          <path d={blocks} fill="none" stroke="#ff5a0a" strokeWidth="6" />
          <circle cx={C} cy={C} r="92" fill="none" stroke="#ff7a00" strokeWidth="6" />
        </g>
        <path d={blocks} fill="rgb(255 120 30 / 0.16)" stroke="#ffa03a" strokeWidth="2.6" strokeLinejoin="round" />
        <circle cx={C} cy={C} r="92" fill="none" stroke="#ffd27a" strokeWidth="2" />
        <circle cx={C} cy={C} r="96" fill="none" stroke="#ff8a2a" strokeWidth="1" strokeDasharray="1.5 4" />
        <path d={ticks} fill="#ffcf7a" opacity="0.9" />
        <circle cx={C} cy={C} r="42" fill="none" stroke="#ff9a3a" strokeWidth="1.4" />
      </svg>
    )
  }
  if (kind === 'cog') {
    const outline = cogPath(70, 88, 12)
    return (
      <svg viewBox="0 0 200 200" aria-hidden>
        {defs}
        <path d={outline} fill="none" stroke="#ff6a12" strokeWidth="7" filter={glow} opacity="0.75" />
        <path d={outline} fill={`url(#${id}m)`} stroke="#ffa040" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={C} cy={C} r="52" fill="none" stroke="#c4561c" strokeWidth="3" />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2
          return (
            <line
              key={i}
              x1={f(C + Math.cos(a) * 18)}
              y1={f(C + Math.sin(a) * 18)}
              x2={f(C + Math.cos(a) * 52)}
              y2={f(C + Math.sin(a) * 52)}
              stroke="#a8461a"
              strokeWidth="6"
              strokeLinecap="round"
            />
          )
        })}
        <circle cx={C} cy={C} r="18" fill="#2a0c05" stroke="#ffb050" strokeWidth="2.4" />
      </svg>
    )
  }
  // A row of glowing bars, like lit panels along a rail.
  return (
    <svg viewBox="0 0 200 40" aria-hidden>
      {defs}
      <g filter={glow}>
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={6 + i * 21.5} y="11" width="13" height="18" rx="2" fill="#ff7a1a" />
        ))}
      </g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={6 + i * 21.5} y="11" width="13" height="18" rx="2" fill="#ffc062" stroke="#fff0c8" strokeWidth="0.8" />
      ))}
    </svg>
  )
}

/** Light running round a rim: a short bright arc turning faster than its ring. */
function Sweep({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden>
      <defs>
        <filter id={`${id}s`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle cx={C} cy={C} r="77" fill="none" stroke="#ffd27a" strokeWidth="12" strokeDasharray="70 414" filter={`url(#${id}s)`} />
      <circle cx={C} cy={C} r="77" fill="none" stroke="#fff6dc" strokeWidth="3" strokeDasharray="56 428" strokeLinecap="round" />
    </svg>
  )
}

/** A beaded chain: a line of dots that creeps along. */
function Chain() {
  return (
    <svg viewBox="0 0 400 10" preserveAspectRatio="none" aria-hidden>
      <line className="clock-chain-dots" x1="0" y1="5" x2="400" y2="5" stroke="#ff9a3a" strokeWidth="4" strokeDasharray="0.1 9" strokeLinecap="round" />
    </svg>
  )
}

type Part = { kind: PartKind | 'sweep' | 'chain'; x: number; y: number; size: number; turn: number; start?: number; reverse?: boolean }

// Positions on the plane (percent of its width), sizes, and seconds per turn (0 = still).
const PARTS: Part[] = [
  { kind: 'dial', x: 26, y: 66, size: 38, turn: 40, start: 10 },
  { kind: 'chain', x: 50, y: 34, size: 120, turn: 0, start: 4 },
  { kind: 'chain', x: 50, y: 57, size: 120, turn: 0, start: -3 },
  { kind: 'chain', x: 50, y: 90, size: 120, turn: 0, start: 2 },
  { kind: 'ring', x: 22, y: 22, size: 24, turn: 16, reverse: true },
  { kind: 'sweep', x: 22, y: 22, size: 24, turn: 3.2 },
  { kind: 'ring', x: 50, y: 18, size: 20, turn: 13 },
  { kind: 'ring', x: 78, y: 28, size: 24, turn: 18, reverse: true },
  { kind: 'sweep', x: 78, y: 28, size: 24, turn: 3.6, reverse: true },
  { kind: 'cog', x: 38, y: 37, size: 12, turn: 8 },
  { kind: 'cog', x: 14, y: 45, size: 11, turn: 7, reverse: true },
  { kind: 'ring', x: 61, y: 42, size: 19, turn: 14 },
  { kind: 'sweep', x: 61, y: 42, size: 19, turn: 2.8 },
  { kind: 'cog', x: 87, y: 52, size: 14, turn: 9, reverse: true },
  { kind: 'ring', x: 54, y: 64, size: 14, turn: 9 },
  { kind: 'ring', x: 74, y: 74, size: 30, turn: 22, reverse: true },
  { kind: 'sweep', x: 74, y: 74, size: 30, turn: 4, reverse: true },
  { kind: 'cog', x: 46, y: 82, size: 14, turn: 10, reverse: true },
  { kind: 'ring', x: 90, y: 88, size: 18, turn: 12 },
  { kind: 'ring', x: 12, y: 88, size: 16, turn: 11, reverse: true },
  { kind: 'bars', x: 64, y: 10, size: 30, turn: 0, start: -8 },
  { kind: 'bars', x: 92, y: 14, size: 20, turn: 0, start: -8 },
  { kind: 'bars', x: 26, y: 94, size: 24, turn: 0, start: 6 },
]

const EMBERS = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: -((i * 0.83) % 5),
  duration: 3.6 + ((i * 7) % 5) * 0.5,
  size: 0.9 + ((i * 3) % 4) * 0.35,
}))

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
