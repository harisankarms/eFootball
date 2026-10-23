import { useState } from 'react'
import { inkOn } from '../lib/colors'
import type { League } from '../lib/queries'

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

type Props = {
  league: League
  id: string
  size?: number
  ring?: 'gold' | 'accent'
  className?: string
}

export function Avatar({ league, id, size = 36, ring, className = '' }: Props) {
  const player = league.byId.get(id)
  const [broken, setBroken] = useState(false)
  const color = league.colorOf(id)
  const name = player?.name ?? '?'
  const ringClass =
    ring === 'gold'
      ? 'ring-[3px] ring-gold ring-offset-2 ring-offset-surface'
      : ring === 'accent'
        ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface'
        : ''
  const base = `shrink-0 rounded-full ${ringClass} ${player && !player.active ? 'grayscale opacity-70' : ''} ${className}`

  if (player?.avatar_url && !broken) {
    return (
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
    )
  }
  return (
    <span
      aria-hidden
      className={`${base} grid place-items-center font-bold`}
      style={{ width: size, height: size, background: color, color: inkOn(color), fontSize: Math.round(size * 0.42) }}
    >
      {initials(name)}
    </span>
  )
}
