import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Check, ChevronRight, Download, Pencil, ShieldCheck, Sparkles, Trophy, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { AvatarEditor } from '../components/AvatarEditor'
import { CardFigureEditor } from '../components/CardFigureEditor'
import { SignInPrompt } from '../components/Guards'
import { MatchCard } from '../components/MatchCard'
import { useToast } from '../components/Toast'
import { Badge, Button, EmptyState, ErrorState, GlowIcon, PageSkeleton, PageTitle, SectionTitle, Toggle } from '../components/ui'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { downloadFile, matchesToCsv } from '../lib/csv'
import { keys, useAuth, useLeague, type League } from '../lib/queries'
import { newestFirst } from '../lib/stats'
import { dayKey, relativeTime } from '../lib/time'
import type { Player, Settings } from '../lib/types'

function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusy(id)
    try {
      await action()
      toast.success(success)
      return true
    } catch (e) {
      toast.error(friendlyError(e))
      return false
    } finally {
      setBusy(null)
    }
  }
  return { busy, run }
}

function JoinRequests({ league }: { league: League }) {
  const qc = useQueryClient()
  const { busy, run } = useAction()
  const requests = useQuery({ queryKey: keys.joinRequests, queryFn: () => api.getJoinRequests() })
  const [linkTo, setLinkTo] = useState<Record<string, string>>({})
  const unlinked = league.players.filter((p) => p.active && !p.user_id)

  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: keys.joinRequests }), qc.invalidateQueries({ queryKey: keys.players })])

  return (
    <section>
      <SectionTitle title="Waiting to join" />
      {requests.isPending ? (
        <div className="card h-20 animate-pulse" />
      ) : requests.error ? (
        <p className="card p-4 text-sm text-ink-2">{friendlyError(requests.error)}</p>
      ) : requests.data.length === 0 ? (
        <p className="card p-4 text-sm text-ink-2">
          Nobody is waiting. When a friend signs in for the first time, they show up here for you to approve.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.data.map((r) => (
            <div key={r.user_id} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 font-bold text-ink-2">
                  {(r.name ?? r.email ?? '?')[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.name ?? 'No name'}</div>
                  <div className="truncate text-xs text-muted">
                    {r.email} · {relativeTime(r.created_at, league.tz)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<UserPlus className="h-4 w-4" />}
                  loading={busy === `new-${r.user_id}`}
                  onClick={async () => {
                    if (await run(`new-${r.user_id}`, () => api.approveJoin(r.user_id, null), `${r.name ?? 'Player'} joined the squad`)) await refresh()
                  }}
                >
                  Add as new player
                </Button>
                {unlinked.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      aria-label="Existing player to link"
                      className="field h-9 w-auto py-0 text-sm"
                      value={linkTo[r.user_id] ?? ''}
                      onChange={(e) => setLinkTo((s) => ({ ...s, [r.user_id]: e.target.value }))}
                    >
                      <option value="">Or link to…</option>
                      {unlinked.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {linkTo[r.user_id] && (
                      <Button
                        size="sm"
                        loading={busy === `link-${r.user_id}`}
                        onClick={async () => {
                          const playerId = linkTo[r.user_id]
                          if (await run(`link-${r.user_id}`, () => api.approveJoin(r.user_id, playerId), 'Account linked')) await refresh()
                        }}
                      >
                        Link
                      </Button>
                    )}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === `no-${r.user_id}`}
                  onClick={async () => {
                    if (await run(`no-${r.user_id}`, () => api.rejectJoin(r.user_id), 'Request dismissed')) await refresh()
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PlayersAdmin({ league, me }: { league: League; me: Player }) {
  const qc = useQueryClient()
  const { busy, run } = useAction()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [photoFor, setPhotoFor] = useState<Player | null>(null)
  const [cardFor, setCardFor] = useState<Player | null>(null)
  const admins = league.players.filter((p) => p.is_admin && p.active)

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keys.players }), qc.invalidateQueries({ queryKey: ['me'] })])
  const update = async (id: string, patch: Parameters<typeof api.updatePlayer>[1], message: string) => {
    if (await run(id, () => api.updatePlayer(id, patch), message)) await refresh()
  }

  return (
    <section>
      <SectionTitle title="Squad" />
      <form
        className="mb-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const name = newName.trim()
          if (!name) return
          if (await run('add', () => api.addPlayer(name), `${name} added`)) {
            setNewName('')
            await refresh()
          }
        }}
      >
        <input
          className="field"
          placeholder="Add a player who won't sign in"
          maxLength={40}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={busy === 'add'} disabled={!newName.trim()} icon={<UserPlus className="h-4 w-4" />}>
          Add
        </Button>
      </form>
      <div className="card divide-y divide-line/70">
        {league.players.map((p) => {
          const lastAdmin = p.is_admin && admins.length <= 1
          return (
            <div key={p.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar league={league} id={p.id} size={36} />
              <div className="min-w-0 flex-1">
                {editing?.id === p.id ? (
                  <form
                    className="flex gap-1.5"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      await update(p.id, { name: editing.name.trim() }, 'Name updated')
                      setEditing(null)
                    }}
                  >
                    <input
                      className="field h-9 py-0"
                      value={editing.name}
                      maxLength={40}
                      autoFocus
                      onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                    />
                    <button type="submit" aria-label="Save name" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel"
                      onClick={() => setEditing(null)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{p.name}</span>
                      <button
                        aria-label={`Rename ${p.name}`}
                        onClick={() => setEditing({ id: p.id, name: p.name })}
                        className="rounded p-1 text-muted hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {p.is_admin && <Badge tone="accent">Admin</Badge>}
                      {p.user_id ? <Badge>Has account</Badge> : <Badge>No account</Badge>}
                      {!p.active && <Badge tone="warn">Inactive</Badge>}
                    </div>
                    <div className="-ml-3 mt-1 flex flex-wrap">
                      <Button size="sm" variant="ghost" icon={<Camera className="h-4 w-4" />} onClick={() => setPhotoFor(p)}>
                        Photo
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Sparkles className="h-4 w-4" />} onClick={() => setCardFor(p)}>
                        Card
                      </Button>
                      {p.user_id && p.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={lastAdmin || busy === p.id}
                          title={lastAdmin ? 'The squad needs at least one admin' : undefined}
                          icon={<ShieldCheck className="h-4 w-4" />}
                          onClick={() => update(p.id, { is_admin: !p.is_admin }, p.is_admin ? 'Admin removed' : `${p.name} is now an admin`)}
                        >
                          {p.is_admin ? 'Remove admin' : 'Make admin'}
                        </Button>
                      )}
                      {p.id !== me.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === p.id || (p.active && lastAdmin)}
                          onClick={() => update(p.id, { active: !p.active }, p.active ? `${p.name} deactivated` : `${p.name} is back`)}
                        >
                          {p.active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        Deactivated players keep their stats but can't log results and are hidden from the player picker.
      </p>
      {photoFor && (
        <AvatarEditor open onClose={() => setPhotoFor(null)} league={league} player={photoFor} self={photoFor.id === me.id} />
      )}
      {cardFor && (
        <CardFigureEditor open onClose={() => setCardFor(null)} league={league} player={cardFor} self={cardFor.id === me.id} />
      )}
    </section>
  )
}

type SettingsDraft = { [K in keyof Settings]: Settings[K] extends number ? string : Settings[K] }

function SettingsForm({ league }: { league: League }) {
  const qc = useQueryClient()
  const { busy, run } = useAction()
  const s = league.settings
  const [form, setForm] = useState<SettingsDraft>(() => ({
    ...s,
    potw_win: String(s.potw_win),
    potw_draw: String(s.potw_draw),
    potw_goal: String(s.potw_goal),
    potw_clean_sheet: String(s.potw_clean_sheet),
    potw_min_matches: String(s.potw_min_matches),
    dispute_hours: String(s.dispute_hours),
  }))
  const [formError, setFormError] = useState<string | null>(null)
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setFormError(null)
    const num = (v: string) => Number(v.replace(',', '.'))
    const patch: Settings = {
      group_name: form.group_name.trim(),
      timezone: form.timezone,
      potw_win: num(form.potw_win),
      potw_draw: num(form.potw_draw),
      potw_goal: num(form.potw_goal),
      potw_clean_sheet: num(form.potw_clean_sheet),
      potw_min_matches: Math.round(num(form.potw_min_matches)),
      dispute_hours: Math.round(num(form.dispute_hours)),
      require_screenshot: form.require_screenshot,
    }
    if (!patch.group_name) return setFormError('Give the group a name.')
    if ([patch.potw_win, patch.potw_draw, patch.potw_goal, patch.potw_clean_sheet].some((n) => !Number.isFinite(n) || n < 0))
      return setFormError('Points must be zero or more.')
    if (!(patch.potw_min_matches >= 0 && patch.potw_min_matches <= 50)) return setFormError('Minimum games must be between 0 and 50.')
    if (!(patch.dispute_hours >= 1 && patch.dispute_hours <= 168)) return setFormError('Dispute window must be 1 to 168 hours.')
    try {
      new Intl.DateTimeFormat('en', { timeZone: patch.timezone })
    } catch {
      return setFormError('Unknown timezone.')
    }
    if (await run('settings', () => api.updateSettings(patch), 'Settings saved')) await qc.invalidateQueries({ queryKey: keys.settings })
  }

  const numberField = (key: 'potw_win' | 'potw_draw' | 'potw_goal' | 'potw_clean_sheet' | 'potw_min_matches' | 'dispute_hours', label: string, step = '0.25') => (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink-2">{label}</span>
      <input className="field" type="number" inputMode="decimal" min="0" step={step} value={form[key]} onChange={(e) => set(key, e.target.value)} />
    </label>
  )

  return (
    <section>
      <SectionTitle title="Settings" />
      <form
        className="card space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">Group name</span>
            <input className="field" maxLength={40} value={form.group_name} onChange={(e) => set('group_name', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">Timezone (when the week resets)</span>
            {zones.length ? (
              <select className="field" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {!zones.includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            ) : (
              <input className="field" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
            )}
          </label>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Player of the Week points</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {numberField('potw_win', 'Per win')}
            {numberField('potw_draw', 'Per draw')}
            {numberField('potw_goal', 'Per goal')}
            {numberField('potw_clean_sheet', 'Per clean sheet')}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 items-end gap-3">
          {numberField('potw_min_matches', 'Min. games a week', '1')}
          {numberField('dispute_hours', 'Dispute window (hours)', '1')}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-2/60 p-3">
          <div>
            <div className="text-sm font-semibold">Require a screenshot</div>
            <div className="text-xs text-muted">Every new result needs the full-time screenshot as proof.</div>
          </div>
          <Toggle checked={form.require_screenshot} onChange={(v) => set('require_screenshot', v)} label="Require a screenshot" />
        </div>

        {formError && <p className="rounded-xl border border-loss/40 bg-[#2a1216] px-3.5 py-2.5 text-sm text-[#ffd0d0]">{formError}</p>}
        <Button type="submit" variant="primary" loading={busy === 'settings'}>
          Save settings
        </Button>
      </form>
    </section>
  )
}

function Backup({ league }: { league: League }) {
  return (
    <section>
      <SectionTitle title="Backup" />
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="max-w-sm text-sm text-ink-2">
          The free database has no automatic backups. Download everything now and then, it opens in Excel or Google Sheets.
        </p>
        <Button
          icon={<Download className="h-4 w-4" />}
          onClick={() =>
            downloadFile(
              `results-${dayKey(new Date(), league.tz)}.csv`,
              matchesToCsv(newestFirst(league.matches), league.nameOf, league.tz, api.imageUrl),
            )
          }
        >
          Download CSV ({league.matches.length})
        </Button>
      </div>
    </section>
  )
}

export default function Admin() {
  const { league, error, refetch } = useLeague()
  const { ready, session, me, meLoading, isAdmin } = useAuth()

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!ready || meLoading || !league) return <PageSkeleton />
  if (!session) return <SignInPrompt reason="as an admin" />
  if (!isAdmin || !me) {
    return (
      <EmptyState icon={ShieldCheck} title="Admins only">
        Ask an admin if you need something changed.
      </EmptyState>
    )
  }

  const disputed = newestFirst(league.matches.filter((m) => m.status === 'disputed'))
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageTitle title="Admin" subtitle="Approve friends, fix results and tune the rules." />
      <JoinRequests league={league} />
      <section>
        <SectionTitle title="Disputed results" />
        {disputed.length ? (
          <div className="space-y-2.5">
            {disputed.map((m) => (
              <MatchCard key={m.id} match={m} league={league} showDate />
            ))}
            <p className="text-xs text-muted">Open a result to confirm it, edit the score or delete it.</p>
          </div>
        ) : (
          <p className="card p-4 text-sm text-ink-2">No disputes. Everyone agrees, for now.</p>
        )}
      </section>
      <PlayersAdmin league={league} me={me} />
      <section>
        <SectionTitle title="Achievements" />
        <Link to="/achievements" className="card card-hover flex items-center gap-3 p-4">
          <GlowIcon icon={Trophy} tint="gold" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Manage achievements</div>
            <div className="text-xs text-muted">Create new ones, change XP, hide them, or award the hand-given ones.</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
      </section>
      <SettingsForm key={JSON.stringify(league.settings)} league={league} />
      <Backup league={league} />
    </div>
  )
}
