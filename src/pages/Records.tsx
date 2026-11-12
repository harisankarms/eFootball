import { ChevronRight, Flame, Medal } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { PlayersTabs } from '../components/PlayersTabs'
import { RECORD_ICONS, recordHeadline, recordLink } from '../components/Records'
import { EmptyState, ErrorState, GlowIcon, PageSkeleton, PageTitle, SectionTitle } from '../components/ui'
import { useLeague, useNow } from '../lib/queries'
import { RECORDS, newsworthy, recordBook, recordInfo, type RecordGroup } from '../lib/records'
import { longDate, relativeTime, weekKey } from '../lib/time'

const GROUPS: { group: RecordGroup; title: string }[] = [
  { group: 'game', title: 'Single games' },
  { group: 'streak', title: 'Streaks' },
  { group: 'week', title: 'In a week' },
  { group: 'career', title: 'All time' },
]

export default function Records() {
  const { league, error, refetch } = useLeague()
  const now = useNow()
  const book = useMemo(() => (league ? recordBook(league.matches, league.settings, weekKey(now, league.tz)) : null), [league, now])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league || !book) return <PageSkeleton />

  // The mark each record replaced, for "Previous" lines.
  const previous = new Map(book.breaks.map((b) => [b.key, b.previous]))
  const recent = newsworthy(book).reverse().slice(0, 12)

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Players" />
      <PlayersTabs />
      {book.current.size === 0 ? (
        <EmptyState icon={Medal} title="No records yet">
          Records are set from the first result: biggest win, longest streak, most points in a week and more.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          {GROUPS.map(({ group, title }) => {
            const list = RECORDS.filter((r) => r.group === group && book.current.has(r.key))
            if (!list.length) return null
            return (
              <section key={group}>
                <SectionTitle title={title} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((info) => {
                    const mark = book.current.get(info.key)!
                    const prev = previous.get(info.key)
                    const { icon, tint } = RECORD_ICONS[info.key]
                    const live = book.live.has(info.key)
                    return (
                      <Link key={info.key} to={recordLink(info.key, mark)} className="card card-hover flex flex-col overflow-hidden p-4">
                        <div className="flex items-center gap-2.5">
                          <GlowIcon icon={icon} tint={tint} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wider text-muted uppercase">{info.title}</span>
                          {live && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 text-[11px] font-semibold text-ember">
                              <Flame className="h-3 w-3" aria-hidden /> Still going
                            </span>
                          )}
                        </div>
                        <div className="mt-3 font-display text-[1.7rem] leading-tight font-bold uppercase italic">
                          {recordHeadline(league, info.key, mark)}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <Avatar league={league} id={mark.holder} size={24} />
                          <span className="min-w-0 truncate font-semibold">{league.nameOf(mark.holder)}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted">{longDate(mark.at, league.tz)}</span>
                        </div>
                        {prev && (
                          <div className="mt-2 border-t border-line/70 pt-2 text-xs text-muted">
                            Before: {info.unit(prev.value)}, {league.nameOf(prev.holder)}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {recent.length > 0 && (
            <section>
              <SectionTitle title="Recently broken" />
              <div className="card divide-y divide-line/70">
                {recent.map((b) => {
                  const info = recordInfo.get(b.key)!
                  return (
                    <Link
                      key={`${b.key}-${b.mark.at}`}
                      to={recordLink(b.key, b.mark)}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50"
                    >
                      <Avatar league={league} id={b.mark.holder} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {league.nameOf(b.mark.holder)} · {info.title}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {recordHeadline(league, b.key, b.mark)}
                          {b.previous && ` (was ${info.unit(b.previous.value)}, ${league.nameOf(b.previous.holder)})`}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{relativeTime(b.mark.at, league.tz, now)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          <p className="text-xs text-muted">
            Records come from every counted result, so fixing a result corrects them too. Weekly records are set when the week ends.
            The first to reach a mark keeps the record until someone beats it.
          </p>
        </div>
      )}
    </div>
  )
}
