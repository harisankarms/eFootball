import { ArrowDown, ArrowUp, Crown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth, type League } from '../lib/queries'
import { formatPct, formatPoints, signed, type Row } from '../lib/stats'
import { Avatar } from './Avatar'
import { FormChips } from './FormChips'

type SortKey = 'points' | 'played' | 'won' | 'drawn' | 'lost' | 'gf' | 'ga' | 'gd' | 'winPct'

const COLUMNS: { key: SortKey; label: string; title: string; wide?: boolean }[] = [
  { key: 'played', label: 'P', title: 'Played' },
  { key: 'won', label: 'W', title: 'Won' },
  { key: 'drawn', label: 'D', title: 'Drawn' },
  { key: 'lost', label: 'L', title: 'Lost' },
  { key: 'gf', label: 'GF', title: 'Goals for', wide: true },
  { key: 'ga', label: 'GA', title: 'Goals against', wide: true },
  { key: 'gd', label: 'GD', title: 'Goal difference' },
  { key: 'winPct', label: 'Win %', title: 'Win percentage', wide: true },
]

const MEDALS = [
  'bg-[linear-gradient(135deg,#ffe9a8,#ffb020)] text-[#2a1d00] shadow-[0_0_14px_-2px_rgb(255_190_60/0.7)]',
  'bg-[linear-gradient(135deg,#f8fafc,#94a3b8)] text-[#0f172a]',
  'bg-[linear-gradient(135deg,#f7c39b,#c0703f)] text-[#2a1206]',
]

function display(r: Row, key: SortKey) {
  if (key === 'gd') return signed(r.gd)
  if (key === 'winPct') return formatPct(r.winPct)
  if (key === 'points') return formatPoints(r.points)
  return r[key]
}

type Props = {
  league: League
  rows: Row[]
  /** Player who holds (or leads the race for) Player of the Week. */
  crownId?: string | null
  showQualification?: boolean
  compact?: boolean
  limit?: number
  sortable?: boolean
}

export function StandingsTable({ league, rows, crownId, showQualification, compact, limit, sortable }: Props) {
  const { me } = useAuth()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'points', dir: -1 })

  const sorted = useMemo(() => {
    if (sort.key === 'points' && sort.dir === -1) return rows
    const rank = new Map(rows.map((r, i) => [r.playerId, i]))
    return [...rows].sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir || rank.get(a.playerId)! - rank.get(b.playerId)!)
  }, [rows, sort])
  const visible = limit ? sorted.slice(0, limit) : sorted

  const header = (key: SortKey, label: string, title: string, extra = '') => {
    const active = sort.key === key
    const Arrow = sort.dir === -1 ? ArrowDown : ArrowUp
    return (
      <th
        key={key}
        scope="col"
        title={title}
        aria-sort={active ? (sort.dir === -1 ? 'descending' : 'ascending') : undefined}
        className={`px-1 py-2.5 text-center font-semibold ${extra}`}
      >
        {sortable ? (
          <button
            onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}
            className={`inline-flex items-center gap-0.5 rounded px-0.5 hover:text-ink ${active ? 'text-ink' : ''}`}
          >
            {label}
            {active && <Arrow className="h-3 w-3" aria-hidden />}
          </button>
        ) : (
          label
        )}
      </th>
    )
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] tracking-wider text-muted uppercase">
            <th scope="col" className="w-10 py-2.5 pr-2 pl-3 text-center font-semibold">
              <span className="sr-only">Position</span>#
            </th>
            <th scope="col" className="py-2.5 pr-2 text-left font-semibold">
              Player
            </th>
            {COLUMNS.map((c) => header(c.key, c.label, c.title, c.wide ? 'hidden md:table-cell' : ''))}
            {!compact && (
              <th scope="col" className="hidden px-2 py-2.5 text-left font-semibold lg:table-cell">
                Form
              </th>
            )}
            {header('points', 'Pts', 'Player of the Week points', 'pr-3')}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => {
            const isMe = me?.id === r.playerId
            const dim = showQualification && !r.qualified
            const crowned = crownId === r.playerId
            const medal = sort.key === 'points' && sort.dir === -1 ? MEDALS[i] : undefined
            return (
              <tr
                key={r.playerId}
                className={`border-t border-line/60 transition-colors hover:bg-white/[0.03] ${
                  isMe ? 'bg-accent/[0.06]' : medal && i === 0 ? 'bg-gold/[0.04]' : ''
                }`}
              >
                <td className="py-2.5 pr-2 pl-3 text-center text-xs font-semibold text-muted tabular-nums">
                  {medal ? <span className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${medal}`}>{i + 1}</span> : i + 1}
                </td>
                <td className="w-full max-w-0 py-2 pr-2">
                  <Link to={`/players/${r.playerId}`} className="flex min-w-0 items-center gap-2.5">
                    <Avatar league={league} id={r.playerId} size={30} className={dim ? 'opacity-60' : ''} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`truncate font-semibold ${dim ? 'text-ink-2' : 'text-ink'}`}>{league.nameOf(r.playerId)}</span>
                        {crowned && <Crown className="h-3.5 w-3.5 shrink-0 text-gold" aria-label="Player of the Week" />}
                      </div>
                      {dim ? (
                        <div className="text-[11px] text-muted">
                          needs {r.gamesNeeded} more game{r.gamesNeeded === 1 ? '' : 's'}
                        </div>
                      ) : (
                        !compact && (
                          <div className="mt-1 lg:hidden">
                            <FormChips form={r.form} size="xs" />
                          </div>
                        )
                      )}
                    </div>
                  </Link>
                </td>
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className={`px-1 text-center tabular-nums ${c.wide ? 'hidden md:table-cell' : ''} ${
                      sort.key === c.key ? 'text-ink' : 'text-ink-2'
                    }`}
                  >
                    {display(r, c.key)}
                  </td>
                ))}
                {!compact && (
                  <td className="hidden px-2 lg:table-cell">
                    <FormChips form={r.form} />
                  </td>
                )}
                <td className="pr-3 pl-1 text-center font-bold text-ink tabular-nums">{formatPoints(r.points)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
