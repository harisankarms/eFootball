import { Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { MatchCard } from '../components/MatchCard'
import { Button, EmptyState, ErrorState, PageSkeleton, PageTitle } from '../components/ui'
import { useLeague, useNow } from '../lib/queries'
import { involves, newestFirst } from '../lib/stats'
import { dayHeading, dayKey } from '../lib/time'
import type { Match } from '../lib/types'

const PAGE = 40

export default function Matches() {
  const { league, error, refetch } = useLeague()
  const [params, setParams] = useSearchParams()
  const [shown, setShown] = useState(PAGE)
  const now = useNow()
  const player = params.get('player')
  const disputedOnly = params.get('status') === 'disputed'

  const filtered = useMemo(() => {
    if (!league) return []
    return newestFirst(league.matches).filter(
      (m) => (!player || involves(m, player)) && (!disputedOnly || m.status === 'disputed'),
    )
  }, [league, player, disputedOnly])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league) return <PageSkeleton />

  const disputedCount = league.matches.filter((m) => m.status === 'disputed').length
  const today = dayKey(now, league.tz)
  const groups: { key: string; matches: Match[] }[] = []
  for (const m of filtered.slice(0, shown)) {
    const key = dayKey(m.played_at, league.tz)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.matches.push(m)
    else groups.push({ key, matches: [m] })
  }

  const setFilter = (next: { player?: string | null; disputed?: boolean }) => {
    const p = new URLSearchParams()
    if (next.player) p.set('player', next.player)
    if (next.disputed) p.set('status', 'disputed')
    setParams(p, { replace: true })
    setShown(PAGE)
  }
  const chip = (active: boolean) =>
    `flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
      active ? 'border-accent/60 bg-accent/12 text-ink' : 'border-line bg-surface text-ink-2 hover:text-ink'
    }`
  const activePlayers = league.players.filter((p) => p.active || league.matches.some((m) => involves(m, p.id)))

  return (
    <div>
      <PageTitle title="Matches" subtitle={`${filtered.length} result${filtered.length === 1 ? '' : 's'}`} />

      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        <button className={chip(!player && !disputedOnly)} onClick={() => setFilter({})}>
          All
        </button>
        {disputedCount > 0 && (
          <button className={chip(disputedOnly)} onClick={() => setFilter({ player, disputed: !disputedOnly })}>
            Disputed
            <span className="rounded-full bg-warn/20 px-1.5 text-xs text-warn">{disputedCount}</span>
          </button>
        )}
        {activePlayers.map((p) => (
          <button
            key={p.id}
            className={chip(player === p.id)}
            onClick={() => setFilter({ player: player === p.id ? null : p.id, disputed: disputedOnly })}
          >
            <Avatar league={league} id={p.id} size={22} />
            {p.name}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<Swords className="h-6 w-6" />} title="No matches here">
          Try a different filter.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-muted uppercase">{dayHeading(g.key, today)}</h2>
              <div className="grid gap-2.5 md:grid-cols-2">
                {g.matches.map((m) => (
                  <MatchCard key={m.id} match={m} league={league} />
                ))}
              </div>
            </section>
          ))}
          {filtered.length > shown && (
            <Button className="w-full" onClick={() => setShown((n) => n + PAGE)}>
              Show more
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
