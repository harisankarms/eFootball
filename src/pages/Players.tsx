import { BrickWall, Crown, Footprints, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { PlayersTabs } from '../components/PlayersTabs'
import { Badge, EmptyState, ErrorState, PageSkeleton, PageTitle } from '../components/ui'
import { useAuth, useLeague, useNow } from '../lib/queries'
import { buildTable, formatPct, pastWeeks, trophyCounts } from '../lib/stats'
import { weekKey } from '../lib/time'

export default function Players() {
  const { league, error, refetch } = useLeague()
  const { me } = useAuth()
  const now = useNow()

  const squad = useMemo(() => {
    if (!league) return []
    const { matches, settings, tz, nameOf, players } = league
    const rows = new Map(buildTable(matches, settings, 0, nameOf).map((r) => [r.playerId, r]))
    const trophies = trophyCounts(pastWeeks(matches, settings, weekKey(now, tz), nameOf))
    return players
      .filter((p) => p.active || rows.has(p.id))
      .map((p) => ({ player: p, row: rows.get(p.id), trophies: trophies.get(p.id) }))
      .sort(
        (a, b) =>
          Number(b.player.active) - Number(a.player.active) ||
          (b.trophies?.potw ?? 0) - (a.trophies?.potw ?? 0) ||
          (b.row?.points ?? 0) - (a.row?.points ?? 0) ||
          a.player.name.localeCompare(b.player.name),
      )
  }, [league, now])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Players" subtitle={`${squad.filter((s) => s.player.active).length} in the squad`} />
      <PlayersTabs />
      {squad.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No players yet">
          The first person to sign in becomes the admin and can add everyone else.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {squad.map(({ player, row, trophies }) => (
            <Link
              key={player.id}
              to={`/players/${player.id}`}
              className={`card flex flex-col items-center px-3 pt-5 pb-4 text-center transition hover:border-line-strong ${
                player.active ? '' : 'opacity-60'
              }`}
            >
              <Avatar league={league} id={player.id} size={60} ring={trophies?.potw ? 'gold' : undefined} />
              <div className="mt-3 flex max-w-full items-center gap-1.5">
                <span className="truncate font-display text-xl leading-tight font-bold uppercase">{player.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {me?.id === player.id && <Badge tone="accent">You</Badge>}
                {!player.active && <Badge>Inactive</Badge>}
              </div>
              <div className="mt-1.5 text-xs text-ink-2">
                {row ? `${row.won}W ${row.drawn}D ${row.lost}L · ${formatPct(row.winPct)}` : 'No games yet'}
              </div>
              {trophies && (trophies.potw > 0 || trophies.goldenBoots > 0 || trophies.walls > 0) && (
                <div className="mt-3 flex items-center gap-3 text-xs font-semibold text-ink-2">
                  {trophies.potw > 0 && (
                    <span className="flex items-center gap-1 text-gold" title="Player of the Week">
                      <Crown className="h-3.5 w-3.5" aria-label="Player of the Week" />×{trophies.potw}
                    </span>
                  )}
                  {trophies.goldenBoots > 0 && (
                    <span className="flex items-center gap-1" title="Golden Boot">
                      <Footprints className="h-3.5 w-3.5" aria-label="Golden Boot" />×{trophies.goldenBoots}
                    </span>
                  )}
                  {trophies.walls > 0 && (
                    <span className="flex items-center gap-1" title="The Wall">
                      <BrickWall className="h-3.5 w-3.5" aria-label="The Wall" />×{trophies.walls}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
