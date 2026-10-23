import { Check, Gift, Lock, Pencil } from 'lucide-react'
import { progressLabel, rarityOf, type AchievementStatus, type Rarity } from '../lib/achievements'
import { longDate } from '../lib/time'
import type { Achievement } from '../lib/types'

export const RARITY: Record<Rarity, { label: string; ring: string; glow: string; text: string }> = {
  common: { label: 'Common', ring: 'from-[#e2e8f0] to-[#64748b]', glow: '0 0 22px -8px rgb(148 163 184 / 0.7)', text: 'text-ink-2' },
  rare: { label: 'Rare', ring: 'from-[#67e8f9] to-[#2563eb]', glow: '0 0 24px -6px rgb(34 211 238 / 0.7)', text: 'text-[#67e8f9]' },
  epic: { label: 'Epic', ring: 'from-[#e9d5ff] to-[#7c3aed]', glow: '0 0 26px -6px rgb(139 92 246 / 0.85)', text: 'text-[#c4b5fd]' },
  legendary: { label: 'Legendary', ring: 'from-[#fff1b8] to-[#f59e0b]', glow: '0 0 28px -6px rgb(255 190 60 / 0.9)', text: 'text-gold' },
}

export function AchievementBadge({ achievement, unlocked, size = 56 }: { achievement: Achievement; unlocked: boolean; size?: number }) {
  const r = RARITY[rarityOf(achievement.xp)]
  return (
    <span
      title={achievement.name}
      className={`relative grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br p-[2px] ${unlocked ? r.ring : 'from-white/15 to-white/5'}`}
      style={{ width: size, height: size, boxShadow: unlocked ? r.glow : undefined }}
    >
      <span className="grid h-full w-full place-items-center rounded-[14px] bg-[linear-gradient(180deg,#1a2550,#0b1229)]" style={{ fontSize: size * 0.46 }}>
        <span className={unlocked ? '' : 'opacity-30 grayscale'} aria-hidden>
          {achievement.emoji}
        </span>
      </span>
      {!unlocked && (
        <span className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-surface-3 ring-2 ring-bg">
          <Lock className="h-3 w-3 text-muted" aria-label="Locked" />
        </span>
      )}
    </span>
  )
}

type Props = {
  status: AchievementStatus
  tz: string
  onEdit?: () => void
  onAward?: () => void
}

export function AchievementCard({ status, tz, onEdit, onAward }: Props) {
  const a = status.achievement
  const r = RARITY[rarityOf(a.xp)]
  const label = progressLabel(status)
  const ratio = status.target ? Math.min(1, status.current / status.target) : 0
  return (
    <div className={`card flex gap-3.5 p-4 ${status.unlocked ? '' : 'bg-[linear-gradient(180deg,rgb(20_28_56/0.6),rgb(11_17_38/0.7))]'}`}>
      <AchievementBadge achievement={a} unlocked={status.unlocked} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`font-semibold ${status.unlocked ? 'text-ink' : 'text-ink-2'}`}>{a.name}</div>
            <div className="text-xs text-muted">{a.description}</div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.unlocked ? 'bg-gold/15 text-gold' : 'bg-white/[0.06] text-muted'}`}>
            +{a.xp} XP
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className={`font-semibold tracking-wider uppercase ${r.text}`}>{r.label}</span>
          {status.unlocked && status.unlockedAt ? (
            <span className="flex items-center gap-1 text-accent">
              <Check className="h-3 w-3" aria-hidden /> Unlocked {longDate(status.unlockedAt, tz)}
            </span>
          ) : (
            a.kind === 'manual' && <span className="text-muted">Awarded by the admin</span>
          )}
        </div>
        {!status.unlocked && label && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#3dff8f,#22d3ee)]" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted tabular-nums">{label}</div>
          </div>
        )}
        {(onEdit || onAward) && (
          <div className="-ml-2 mt-1.5 flex gap-1">
            {onAward && (
              <button onClick={onAward} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-white/[0.06] hover:text-ink">
                <Gift className="h-3.5 w-3.5" aria-hidden /> Award
              </button>
            )}
            {onEdit && (
              <button onClick={onEdit} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-white/[0.06] hover:text-ink">
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
