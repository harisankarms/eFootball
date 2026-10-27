import { useId } from 'react'
import './chenda.css'

// The drum head, where each stick lands on it, and the bottom hoop.
const HEAD = { x: 50, y: 44, rx: 24.5, ry: 6.5 }
const FOOT = 124
// Each stick is a curved cane held off the card (its pivot, where chenda.css turns it), long
// enough that swinging it moves the tip up and down rather than across the rating.
const SIDES = {
  left: { hit: { x: 43, y: 45 }, stick: 'M-20 52 Q15 36 43 45', waves: { x: 21, sweep: 0, dir: -1 } },
  right: { hit: { x: 59.5, y: 44.5 }, stick: 'M120 48 Q86 33 59.5 44.5', waves: { x: 79, sweep: 1, dir: 1 } },
} as const
const WAVES_Y = 68

/** The rope lacing: a zigzag round the front of the drum between the two hoops. */
function lacing() {
  const points: string[] = []
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / steps
    const x = HEAD.x + (HEAD.rx + 0.3) * Math.sin(angle)
    const y = (i % 2 ? FOOT - 1 : HEAD.y + 2) + HEAD.ry * 0.9 * Math.cos(angle)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return points.join(' ')
}

const LIGHTS = [
  [12, 13, 0], [24, 8, -0.7], [37, 11, -1.3], [63, 11, -0.4], [76, 8, -1.1], [88, 13, -1.8],
  [6, 33, -0.9], [94, 31, -0.2], [8, 62, -1.5], [92, 60, -0.6], [5, 88, -1.2], [95, 86, -0.3],
] as const

/** A chenda being beaten with two sticks: the background of the week's chenda card. */
export function ChendaScene() {
  const id = useId()
  const url = (name: string) => `url(#${id}${name})`
  const body = `M${HEAD.x - HEAD.rx} ${HEAD.y} V${FOOT} A${HEAD.rx} ${HEAD.ry} 0 0 0 ${HEAD.x + HEAD.rx} ${FOOT} V${HEAD.y} Z`
  return (
    <svg className="chenda-scene" viewBox="0 0 100 143" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="31%" r="80%">
          <stop offset="0" stopColor="#b3261a" />
          <stop offset="0.45" stopColor="#5a0f0a" />
          <stop offset="1" stopColor="#160302" />
        </radialGradient>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" stopColor="#ffc46b" stopOpacity="0.6" />
          <stop offset="0.5" stopColor="#ff8a3d" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
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

      <rect width="100" height="143" fill={url('bg')} />
      <g className="chenda-rays chenda-anim">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${HEAD.x} ${HEAD.y} L${HEAD.x - 4} -60 L${HEAD.x + 4} -60 Z`} transform={`rotate(${i * 30} ${HEAD.x} ${HEAD.y})`} />
        ))}
      </g>
      <circle cx={HEAD.x} cy={HEAD.y} r="46" fill={url('glow')} className="chenda-glow chenda-anim" />
      {LIGHTS.map(([x, y, delay], i) => (
        <circle key={i} cx={x} cy={y} r="1.2" className="chenda-light chenda-anim" style={{ animationDelay: `${delay}s` }} />
      ))}

      {(['left', 'right'] as const).map((side) => {
        const { x, sweep, dir } = SIDES[side].waves
        return (
          <g key={side} className={`chenda-waves chenda-anim is-${side}`}>
            {[0, 1, 2].map((i) => {
              const r = 5 + i * 3.4
              const at = x + dir * i * 3.2
              return <path key={i} d={`M${at} ${WAVES_Y - r * 0.85} A${r} ${r} 0 0 ${sweep} ${at} ${WAVES_Y + r * 0.85}`} />
            })}
          </g>
        )
      })}

      <g className="chenda-drum chenda-anim">
        <ellipse cx={HEAD.x} cy={FOOT + 9} rx={HEAD.rx + 6} ry="4" fill="#000" opacity="0.35" />
        <path d={body} fill={url('wood')} />
        <path d={`M${HEAD.x - 9} ${HEAD.y + 6} V${FOOT + 5}`} stroke="#fff" strokeOpacity="0.09" strokeWidth="3" />
        <ellipse cx={HEAD.x} cy={FOOT} rx={HEAD.rx + 0.4} ry={HEAD.ry} fill="none" stroke="#1d0c03" strokeWidth="1.6" />
        <path d={`M${HEAD.x - HEAD.rx} 97 A${HEAD.rx} ${HEAD.ry} 0 0 0 ${HEAD.x + HEAD.rx} 97`} fill="none" stroke="#e0a53f" strokeWidth="1.5" />
        <path d={`M${HEAD.x - HEAD.rx} 100 A${HEAD.rx} ${HEAD.ry} 0 0 0 ${HEAD.x + HEAD.rx} 100`} fill="none" stroke="#a51d13" strokeWidth="2" />
        <polyline points={lacing()} fill="none" stroke="#f4e4c1" strokeWidth="0.5" strokeLinejoin="round" opacity="0.72" />
        <ellipse cx={HEAD.x} cy={HEAD.y} rx={HEAD.rx + 1.5} ry={HEAD.ry + 1.4} fill="#241004" />
        <g className="chenda-head chenda-anim">
          <ellipse cx={HEAD.x} cy={HEAD.y} rx={HEAD.rx} ry={HEAD.ry} fill={url('skin')} />
          <ellipse cx={HEAD.x} cy={HEAD.y + 0.3} rx={HEAD.rx * 0.4} ry={HEAD.ry * 0.4} fill="#b08a55" opacity="0.32" />
          <g clipPath={url('head')}>
            {(['left', 'right'] as const).map((side) => (
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

      {(['left', 'right'] as const).map((side) => {
        const { x, y } = SIDES[side].hit
        return (
          <g key={side} className={`chenda-burst chenda-anim is-${side}`} style={{ transformOrigin: `${x}px ${y}px` }}>
            {[-155, -125, -90, -55, -25].map((deg) => {
              const a = (deg * Math.PI) / 180
              return (
                <line
                  key={deg}
                  x1={x + 3 * Math.cos(a)}
                  y1={y + 3 * Math.sin(a)}
                  x2={x + 6.5 * Math.cos(a)}
                  y2={y + 6.5 * Math.sin(a)}
                />
              )
            })}
          </g>
        )
      })}

      {(['left', 'right'] as const).map((side) => (
        <g key={side} className={`chenda-stick chenda-anim is-${side}`}>
          <path d={SIDES[side].stick} stroke="#3a200c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d={SIDES[side].stick} stroke={url('stick')} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>
      ))}
    </svg>
  )
}
