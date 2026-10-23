import { useQueryClient } from '@tanstack/react-query'
import { Check, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { BackButton, Button, ErrorState, PageSkeleton, PageTitle, Segmented, Toggle } from '../components/ui'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { keys, useAuth, useLeague } from '../lib/queries'
import { formatSummary, gamesInTotal } from '../lib/tournaments'
import type { Tournament } from '../lib/types'

const KNOCKOUTS: { size: Tournament['knockout_size']; label: string; detail: string }[] = [
  { size: 0, label: 'None', detail: 'Top of the table wins' },
  { size: 2, label: 'Final', detail: 'Top 2 play a final' },
  { size: 4, label: 'Semi-finals', detail: 'Top 4, then a final' },
  { size: 8, label: 'Quarter-finals', detail: 'Top 8, semis, final' },
]

export default function NewTournament() {
  const { league, error, refetch } = useLeague()
  const { me } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<string[]>(() => (me ? [me.id] : []))
  const [rounds, setRounds] = useState<'1' | '2'>('1')
  const [knockout, setKnockout] = useState<Tournament['knockout_size']>(4)
  const [counts, setCounts] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league) return <PageSkeleton />

  const squad = league.players.filter((p) => p.active)
  const size = Math.min(knockout, players.length >= 8 ? 8 : players.length >= 4 ? 4 : players.length >= 2 ? 2 : 0) as Tournament['knockout_size']
  const format = { league_rounds: Number(rounds) as 1 | 2, knockout_size: size }

  function toggle(id: string) {
    setPlayers((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  async function create() {
    setFormError(null)
    if (!name.trim()) return setFormError('Give the tournament a name.')
    if (players.length < 2) return setFormError('Pick at least two players.')
    if (players.length > 16) return setFormError('A tournament can have up to 16 players.')
    setSaving(true)
    try {
      const id = await api.createTournament({ name: name.trim(), players, ...format, counts_in_stats: counts })
      await qc.invalidateQueries({ queryKey: keys.tournaments })
      toast.success(`${name.trim()} is on 🏆`)
      navigate(`/tournaments/${id}`, { replace: true })
    } catch (e) {
      setFormError(friendlyError(e))
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BackButton fallback="/tournaments" />
      <PageTitle title="New tournament" />

      <section className="card p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-2">Name</span>
          <input className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Cup" />
        </label>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-2">Players</h2>
          <span className="text-xs text-muted">{players.length} picked</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {squad.map((p) => {
            const picked = players.includes(p.id)
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => toggle(p.id)}
                aria-pressed={picked}
                className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition ${
                  picked ? 'bg-accent/12 ring-1 ring-accent' : 'opacity-60 hover:bg-surface-2 hover:opacity-100'
                }`}
              >
                <Avatar league={league} id={p.id} size={44} />
                <span className="w-full truncate text-center text-xs font-semibold">{p.name}</span>
                {picked && (
                  <span className="absolute top-1 right-1.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-ink">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">League stage</h2>
          <Segmented
            label="League stage"
            value={rounds}
            options={[
              { value: '1', label: 'Play each other once' },
              { value: '2', label: 'Twice' },
            ]}
            onChange={setRounds}
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Knockouts</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KNOCKOUTS.map((k) => {
              const possible = k.size <= players.length
              const chosen = size === k.size
              return (
                <button
                  type="button"
                  key={k.size}
                  disabled={!possible}
                  onClick={() => setKnockout(k.size)}
                  aria-pressed={chosen}
                  className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-30 ${
                    chosen ? 'border-accent bg-accent/[0.08]' : 'border-line-strong bg-surface-2 hover:border-accent/50'
                  }`}
                >
                  <div className="text-sm font-semibold">{k.label}</div>
                  <div className="text-[11px] text-muted">{k.detail}</div>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 border-t border-line pt-4">
          <div>
            <div className="font-semibold">Count in the main table and stats</div>
            <div className="text-xs text-muted">
              {counts
                ? 'Results also count for the table, Player of the Week, achievements and head-to-heads.'
                : 'Results only count inside this tournament, not for the table, Player of the Week, achievements or head-to-heads.'}{' '}
              This can't be changed later.
            </div>
          </div>
          <Toggle checked={counts} onChange={setCounts} label="Count in the main table and stats" />
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 text-sm text-ink-2">
        <Trophy className="h-5 w-5 shrink-0 text-gold" aria-hidden />
        <p>
          {players.length >= 2
            ? `${players.length} players · ${formatSummary(format)} · ${gamesInTotal(format, players.length)} games in all.`
            : 'Pick at least two players.'}
        </p>
      </div>

      {formError && (
        <p role="alert" className="rounded-xl border border-loss/40 bg-[#2a1216] px-3.5 py-2.5 text-sm text-[#ffd0d0]">
          {formError}
        </p>
      )}
      <Button variant="primary" size="lg" className="w-full" loading={saving} onClick={() => void create()} icon={<Trophy className="h-5 w-5" />}>
        Create tournament
      </Button>
    </div>
  )
}
