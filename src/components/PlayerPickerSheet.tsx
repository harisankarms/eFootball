import { involves } from '../lib/stats'
import type { League } from '../lib/queries'
import { Avatar } from './Avatar'
import { Sheet } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  league: League
  title: string
  selected?: string
  /** A player who can't be picked (for example the other side of a head-to-head). */
  exclude?: string
  onPick: (id: string) => void
}

export function PlayerPickerSheet({ open, onClose, league, title, selected, exclude, onPick }: Props) {
  const players = league.players.filter((p) => p.active || league.matches.some((m) => involves(m, p.id)))
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid grid-cols-4 gap-1.5">
        {players.map((p) => {
          const isSelected = p.id === selected
          return (
            <button
              key={p.id}
              disabled={p.id === exclude}
              onClick={() => {
                onPick(p.id)
                onClose()
              }}
              className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 transition disabled:opacity-25 ${
                isSelected ? 'bg-accent/12 ring-1 ring-accent' : 'hover:bg-white/[0.05]'
              }`}
            >
              <Avatar league={league} id={p.id} size={46} />
              <span className="w-full truncate text-center text-xs font-semibold">{p.name}</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
