import { useId } from 'react'
import type { LevelInfo } from '../lib/achievements'

const TIERS = [
  { upTo: 3, from: '#f7c39b', to: '#a8552a' },
  { upTo: 6, from: '#f8fafc', to: '#7d8ea8' },
  { upTo: 9, from: '#fff1b8', to: '#e88a00' },
  { upTo: Infinity, from: '#f0abfc', to: '#6d28d9' },
]

/** Hexagon badge: bronze for levels 1-3, silver 4-6, gold 7-9, elite from 10. */
export function LevelBadge({ level, size = 36 }: { level: number; size?: number }) {
  const id = useId()
  const tier = TIERS.find((t) => level <= t.upTo)!
  return (
    <svg viewBox="0 0 40 44" width={size} height={size * 1.1} role="img" aria-label={`Level ${level}`} className="shrink-0 drop-shadow-[0_2px_8px_rgb(0_0_0/0.45)]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tier.from} />
          <stop offset="1" stopColor={tier.to} />
        </linearGradient>
      </defs>
      <polygon points="20,1 38,11.5 38,32.5 20,43 2,32.5 2,11.5" fill={`url(#${id})`} />
      <polygon points="20,5.5 34.2,13.8 34.2,30.2 20,38.5 5.8,30.2 5.8,13.8" fill="#0b1229" fillOpacity="0.38" />
      <text
        x="20"
        y="27.5"
        textAnchor="middle"
        fontSize={level >= 10 ? 15 : 17}
        fontWeight="800"
        fill="#ffffff"
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth="2"
        paintOrder="stroke"
        fontFamily="'Inter Variable', system-ui, sans-serif"
      >
        {level}
      </text>
    </svg>
  )
}

export function XpBar({ info, compact = false }: { info: LevelInfo; compact?: boolean }) {
  return (
    <div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-label="XP to next level"
        aria-valuemin={info.floor}
        aria-valuemax={info.next}
        aria-valuenow={info.xp}
      >
        <div
          className="h-full origin-left animate-grow-x rounded-full bg-[linear-gradient(90deg,#3dff8f,#22d3ee,#8b5cf6)] shadow-[0_0_12px_rgb(61_255_143/0.55)]"
          style={{ width: `${Math.max(3, info.progress * 100)}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted tabular-nums">
          <span>{info.xp.toLocaleString()} XP</span>
          <span>
            {(info.next - info.xp).toLocaleString()} XP to level {info.level + 1}
          </span>
        </div>
      )}
    </div>
  )
}

export function LevelCard({ info, unlocked, total }: { info: LevelInfo; unlocked: number; total: number }) {
  return (
    <section className="card overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.28),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(61_255_143/0.16),transparent_70%)]" />
      <div className="relative flex items-center gap-4">
        <LevelBadge level={info.level} size={68} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">Level {info.level}</div>
          <div className="truncate font-display text-[2rem] leading-tight font-bold uppercase italic">{info.title}</div>
          <div className="text-sm text-ink-2">
            {info.xp.toLocaleString()} XP · {unlocked} of {total} achievements
          </div>
        </div>
      </div>
      <div className="relative mt-4">
        <XpBar info={info} />
      </div>
    </section>
  )
}
