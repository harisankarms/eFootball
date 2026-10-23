import { useState } from 'react'
import { inkOn } from '../lib/colors'
import type { League } from '../lib/queries'

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

type Props = {
  league: League
  id: string
  size?: number
  ring?: 'gold' | 'accent' | 'gradient'
  className?: string
}

export function Avatar({ league, id, size = 36, ring, className = '' }: Props) {
  const player = league.byId.get(id)
  const [broken, setBroken] = useState(false)
  const color = league.colorOf(id)
  const name = player?.name ?? '?'
  const solidRing =
    ring === 'gold'
      ? 'ring-[3px] ring-gold ring-offset-2 ring-offset-bg shadow-[0_0_26px_-2px_rgb(255_207_77/0.65)]'
      : ring === 'accent'
        ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg shadow-[0_0_20px_-4px_rgb(61_255_143/0.7)]'
        : ''
  const base = `shrink-0 rounded-full ${solidRing} ${player && !player.active ? 'grayscale opacity-70' : ''} ${ring === 'gradient' ? '' : className}`

  const face =
    player?.avatar_url && !broken ? (
      <img
        src={player.avatar_url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${base} object-cover`}
        style={{ width: size, height: size }}
      />
    ) : (
      <span
        aria-hidden
        className={`${base} grid place-items-center font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.25),inset_0_-8px_16px_-8px_rgb(0_0_0/0.35)]`}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.28), transparent 55%), ${color}`,
          color: inkOn(color),
          fontSize: Math.round(size * 0.42),
        }}
      >
        {initials(name)}
      </span>
    )

  if (ring !== 'gradient') return face
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#3dff8f,#22d3ee,#8b5cf6)] p-[2.5px] shadow-[0_0_22px_-4px_rgb(61_255_143/0.6)] ${className}`}
    >
      <span className="grid rounded-full bg-bg p-[2px]">{face}</span>
    </span>
  )
}
