import { useQueryClient } from '@tanstack/react-query'
import { Trash } from 'lucide-react'
import { useEffect, useState } from 'react'
import { METRICS, METRIC_KEYS, isMetric, type MetricKey } from '../lib/achievements'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { keys } from '../lib/queries'
import type { Achievement } from '../lib/types'
import { useToast } from './Toast'
import { Button, Segmented, Sheet, Toggle } from './ui'

const EMOJIS = ['🏆', '⚽', '🔥', '🎯', '👑', '💎', '🧤', '⚡', '🚀', '🛡️', '🎩', '🥇', '🌟', '🦁', '🎮', '💪']
const XP_PRESETS = [25, 50, 100, 200, 500]

type Draft = {
  emoji: string
  name: string
  description: string
  xp: string
  kind: 'auto' | 'manual'
  metric: MetricKey
  threshold: string
  active: boolean
}

function draftFrom(a: Achievement | null): Draft {
  return {
    emoji: a?.emoji ?? '🏆',
    name: a?.name ?? '',
    description: a?.description ?? '',
    xp: String(a?.xp ?? 100),
    kind: a?.kind ?? 'auto',
    metric: isMetric(a?.metric ?? null) ? (a!.metric as MetricKey) : 'goals',
    threshold: String(a?.threshold ?? 10),
    active: a?.active ?? true,
  }
}

/** Create or edit an achievement. Admin only. */
export function AchievementEditor({ open, onClose, achievement }: { open: boolean; onClose: () => void; achievement: Achievement | null }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [d, setD] = useState<Draft>(() => draftFrom(achievement))
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setD(draftFrom(achievement))
      setError(null)
    }
  }, [open, achievement])
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keys.achievements }), qc.invalidateQueries({ queryKey: keys.awards })])

  async function save() {
    setError(null)
    const xp = Math.round(Number(d.xp))
    const threshold = Math.round(Number(d.threshold))
    if (!d.name.trim()) return setError('Give it a name.')
    if (!d.emoji.trim()) return setError('Pick an emoji.')
    if (!(xp >= 1 && xp <= 10000)) return setError('XP must be between 1 and 10,000.')
    if (d.kind === 'auto' && !(threshold >= 1)) return setError('The target must be at least 1.')
    setBusy('save')
    try {
      await api.saveAchievement(
        {
          emoji: d.emoji.trim(),
          name: d.name,
          description: d.description,
          xp,
          kind: d.kind,
          metric: d.kind === 'auto' ? d.metric : null,
          threshold: d.kind === 'auto' ? threshold : null,
          active: d.active,
        },
        achievement?.id ?? null,
      )
      await refresh()
      toast.success(achievement ? 'Achievement updated' : `${d.emoji} ${d.name.trim()} added`)
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!achievement || !window.confirm(`Delete "${achievement.name}"? Players lose the XP it gave them.`)) return
    setBusy('delete')
    try {
      await api.deleteAchievement(achievement.id)
      await refresh()
      toast.success('Achievement deleted')
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  const unit = METRICS[d.metric].unit
  return (
    <Sheet open={open} onClose={onClose} title={achievement ? 'Edit achievement' : 'New achievement'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="flex gap-3">
          <label className="block w-20 shrink-0">
            <span className="mb-1.5 block text-sm text-ink-2">Emoji</span>
            <input className="field text-center text-2xl" value={d.emoji} maxLength={16} onChange={(e) => set('emoji', e.target.value)} />
          </label>
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-sm text-ink-2">Name</span>
            <input className="field" value={d.name} maxLength={40} placeholder="e.g. Sniper" onChange={(e) => set('name', e.target.value)} />
          </label>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => set('emoji', e)}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg transition ${d.emoji === e ? 'bg-accent/15 ring-1 ring-accent' : 'hover:bg-white/[0.06]'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">Description</span>
          <input className="field" value={d.description} maxLength={140} placeholder="What do you have to do?" onChange={(e) => set('description', e.target.value)} />
        </label>
        <div>
          <span className="mb-1.5 block text-sm text-ink-2">XP reward</span>
          <div className="flex gap-2">
            <input className="field w-28" type="number" min={1} max={10000} inputMode="numeric" value={d.xp} onChange={(e) => set('xp', e.target.value)} />
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {XP_PRESETS.map((x) => (
                <button
                  type="button"
                  key={x}
                  onClick={() => set('xp', String(x))}
                  className={`h-11 shrink-0 rounded-xl px-3 text-sm font-semibold transition ${d.xp === String(x) ? 'bg-gold/15 text-gold ring-1 ring-gold/50' : 'bg-white/[0.05] text-ink-2 hover:text-ink'}`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm text-ink-2">How is it earned?</span>
          <Segmented
            label="How is it earned"
            value={d.kind}
            onChange={(v) => set('kind', v)}
            options={[
              { value: 'auto', label: 'Automatically' },
              { value: 'manual', label: 'Awarded by admin' },
            ]}
          />
        </div>
        {d.kind === 'auto' ? (
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm text-ink-2">Stat</span>
              <select className="field" value={d.metric} onChange={(e) => set('metric', e.target.value as MetricKey)}>
                {METRIC_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {METRICS[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-2">Target</span>
              <input className="field" type="number" min={1} inputMode="numeric" value={d.threshold} onChange={(e) => set('threshold', e.target.value)} />
            </label>
            <p className="col-span-2 text-xs text-muted">
              Unlocks automatically at {d.threshold || '?'} {unit}. Past matches count too.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">You award it to players yourself from the achievement's Award button, for things the site can't see, like a pack pull or a ranked division.</p>
        )}
        <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.04] p-3">
          <div>
            <div className="text-sm font-semibold">Show it</div>
            <div className="text-xs text-muted">Hidden achievements give no XP.</div>
          </div>
          <Toggle checked={d.active} onChange={(v) => set('active', v)} label="Show this achievement" />
        </div>
        {error && <p className="rounded-xl border border-loss/40 bg-[#2a1216] px-3.5 py-2.5 text-sm text-[#ffd0d0]">{error}</p>}
        <div className="flex gap-2">
          {achievement && !achievement.slug && (
            <Button variant="danger" loading={busy === 'delete'} icon={<Trash className="h-4 w-4" />} onClick={() => void remove()}>
              Delete
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-1" loading={busy === 'save'}>
            {achievement ? 'Save changes' : 'Create achievement'}
          </Button>
        </div>
        {achievement?.slug && <p className="text-center text-xs text-muted">Built-in achievements can be hidden but not deleted.</p>}
      </form>
    </Sheet>
  )
}
