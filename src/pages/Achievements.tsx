import { ChevronDown, EyeOff, Plus, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AchievementCard } from '../components/AchievementCard'
import { AchievementEditor } from '../components/AchievementEditor'
import { Avatar } from '../components/Avatar'
import { AwardSheet } from '../components/AwardSheet'
import { LevelBadge, LevelCard } from '../components/Level'
import { PlayerPickerSheet } from '../components/PlayerPickerSheet'
import { Button, EmptyState, ErrorState, PageSkeleton, PageTitle, SectionTitle, Segmented } from '../components/ui'
import { LEVEL_TITLES, xpForLevel, type AchievementStatus } from '../lib/achievements'
import { useAuth, useLeague, useProgress } from '../lib/queries'
import type { Achievement } from '../lib/types'

type Filter = 'all' | 'unlocked' | 'locked'

const ratio = (s: AchievementStatus) => (s.achievement.kind === 'manual' ? -1 : s.current / s.target)

export default function Achievements() {
  const { league, error, refetch } = useLeague()
  const progress = useProgress(league)
  const { me, isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<{ achievement: Achievement | null } | null>(null)
  const [awarding, setAwarding] = useState<Achievement | null>(null)
  const [picking, setPicking] = useState(false)

  const playerId = useMemo(() => {
    if (!league) return null
    const asked = params.get('player')
    if (asked && league.byId.has(asked)) return asked
    if (me && league.byId.has(me.id)) return me.id
    return league.players[0]?.id ?? null
  }, [league, params, me])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league || !progress) return <PageSkeleton />

  const title = (
    <PageTitle
      title="Achievements"
      subtitle="Earn XP, level up, and flex on the squad."
      action={
        isAdmin && (
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ achievement: null })}>
            New
          </Button>
        )
      }
    />
  )
  const sheets = (
    <>
      <AchievementEditor open={!!editing} onClose={() => setEditing(null)} achievement={editing?.achievement ?? null} />
      <AwardSheet achievement={awarding} league={league} onClose={() => setAwarding(null)} />
    </>
  )

  if (!playerId) {
    return (
      <div className="mx-auto max-w-3xl">
        {title}
        <EmptyState icon={Trophy} title="No players yet">
          Achievements appear once players join.
        </EmptyState>
        {sheets}
      </div>
    )
  }

  const statuses = progress.statusesOf(playerId)
  const info = progress.levelOf(playerId)
  const unlocked = statuses.filter((s) => s.unlocked).sort((a, b) => Date.parse(b.unlockedAt ?? '') - Date.parse(a.unlockedAt ?? ''))
  const locked = statuses.filter((s) => !s.unlocked).sort((a, b) => ratio(b) - ratio(a))
  const hidden = progress.achievements.filter((a) => !a.active)
  const isMe = me?.id === playerId

  const card = (s: AchievementStatus) => (
    <AchievementCard
      key={s.achievement.id}
      status={s}
      tz={league.tz}
      onEdit={isAdmin ? () => setEditing({ achievement: s.achievement }) : undefined}
      onAward={isAdmin && s.achievement.kind === 'manual' ? () => setAwarding(s.achievement) : undefined}
    />
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {title}

      <button onClick={() => setPicking(true)} className="card card-hover flex w-full items-center gap-3 p-3 text-left">
        <Avatar league={league} id={playerId} size={40} ring={isMe ? 'gradient' : undefined} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {league.nameOf(playerId)}
            {isMe && <span className="ml-1.5 text-xs font-semibold text-accent">(you)</span>}
          </div>
          <div className="text-xs text-muted">Tap to see another player's achievements</div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>

      <LevelCard info={info} unlocked={unlocked.length} total={statuses.length} />

      <Segmented
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `All ${statuses.length}` },
          { value: 'unlocked', label: `Unlocked ${unlocked.length}` },
          { value: 'locked', label: `Locked ${locked.length}` },
        ]}
      />

      {filter !== 'locked' && unlocked.length > 0 && (
        <section>
          {filter === 'all' && <SectionTitle title="Unlocked" />}
          <div className="grid gap-3 md:grid-cols-2">{unlocked.map(card)}</div>
        </section>
      )}
      {filter !== 'unlocked' && locked.length > 0 && (
        <section>
          {filter === 'all' && <SectionTitle title="Still to unlock" />}
          <div className="grid gap-3 md:grid-cols-2">{locked.map(card)}</div>
        </section>
      )}
      {filter === 'unlocked' && unlocked.length === 0 && (
        <EmptyState icon={Trophy} title="Nothing unlocked yet">
          Play a match to unlock the first one.
        </EmptyState>
      )}

      {isAdmin && hidden.length > 0 && (
        <section>
          <SectionTitle title="Hidden" />
          <div className="card divide-y divide-white/[0.06]">
            {hidden.map((a) => (
              <button
                key={a.id}
                onClick={() => setEditing({ achievement: a })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <span className="text-xl opacity-50 grayscale" aria-hidden>
                  {a.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{a.name}</span>
                <EyeOff className="h-4 w-4 text-muted" aria-label="Hidden" />
              </button>
            ))}
          </div>
        </section>
      )}

      <details className="card group p-4">
        <summary className="flex list-none items-center justify-between font-semibold">
          How levels work
          <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-2 text-sm text-ink-2">Every achievement gives XP. XP decides your level, and each level needs a bit more than the last.</p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {LEVEL_TITLES.map((t, i) => {
            const level = i + 1
            const current = level === info.level || (level === LEVEL_TITLES.length && info.level > level)
            return (
              <li
                key={t}
                className={`flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm ${current ? 'bg-accent/10 ring-1 ring-accent/40' : ''}`}
              >
                <LevelBadge level={level} size={26} />
                <span className="flex-1 font-semibold">{t}</span>
                <span className="text-xs text-muted tabular-nums">{xpForLevel(level).toLocaleString()} XP</span>
              </li>
            )
          })}
        </ul>
      </details>

      <PlayerPickerSheet
        open={picking}
        onClose={() => setPicking(false)}
        league={league}
        title="Whose achievements?"
        selected={playerId}
        onPick={(id) => setParams(id === me?.id ? {} : { player: id }, { replace: true })}
      />
      {sheets}
    </div>
  )
}
