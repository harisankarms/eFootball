import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { keys, useAuth, useAwards, type League } from '../lib/queries'
import type { Achievement } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { Sheet } from './ui'

/** Admin: give or take back an achievement for each player. */
export function AwardSheet({ achievement, league, onClose }: { achievement: Achievement | null; league: League; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { me } = useAuth()
  const { data: awards = [] } = useAwards()
  const [busy, setBusy] = useState<string | null>(null)
  const players = league.players.filter((p) => p.active)

  async function toggle(playerId: string, has: boolean) {
    if (!achievement || !me) return
    setBusy(playerId)
    try {
      await api.setAward(playerId, achievement.id, !has, me.id)
      await qc.invalidateQueries({ queryKey: keys.awards })
      toast.success(has ? 'Award removed' : `${achievement.emoji} ${league.nameOf(playerId)} earned ${achievement.name} (+${achievement.xp} XP)`)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={!!achievement} onClose={onClose} title={achievement ? `Award ${achievement.name}` : 'Award'}>
      {achievement?.kind === 'auto' && (
        <p className="mb-3 text-xs text-muted">This one unlocks automatically. Awarding it by hand also counts, for example for matches played before the site existed.</p>
      )}
      <div className="space-y-1.5">
        {players.map((p) => {
          const has = awards.some((w) => w.player_id === p.id && w.achievement_id === achievement?.id)
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
              <Avatar league={league} id={p.id} size={34} />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <button
                onClick={() => void toggle(p.id, has)}
                disabled={busy === p.id}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-50 ${
                  has ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'bg-white/[0.06] text-ink-2 hover:text-ink'
                }`}
              >
                {has && <Check className="h-4 w-4" aria-hidden />}
                {has ? 'Awarded' : 'Award'}
              </button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
