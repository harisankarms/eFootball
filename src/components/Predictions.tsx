import { useQueryClient } from '@tanstack/react-query'
import { Check, Crown, Eye, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { oracleTable, predictionWindow, rightGuesses } from '../lib/predictions'
import { keys, useAuth, usePredictions, type League } from '../lib/queries'
import { pastWeeks, type WeekResult } from '../lib/stats'
import { clockTime, shortDate } from '../lib/time'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { SectionTitle } from './ui'

/** "Who'll be Player of the Week?": pick until the end of Tuesday, see everyone's picks after. */
export function PredictionsSection({ league, now, week, lastWeek }: { league: League; now: Date; week: WeekResult; lastWeek: WeekResult }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { me, isMember } = useAuth()
  const { data } = usePredictions()
  const [busy, setBusy] = useState<string | null>(null)
  const predictions = useMemo(() => data ?? [], [data])
  const picking = predictionWindow(now, league.tz)
  const oracle = useMemo(
    () => oracleTable(predictions, pastWeeks(league.matches, league.settings, picking.week, league.nameOf)),
    [predictions, league, picking.week],
  )
  if (!isMember || !me) return null

  const thisWeek = predictions.filter((p) => p.week_key === picking.week)
  const mine = thisWeek.find((p) => p.player_id === me.id)
  const squad = league.players.filter((p) => p.active)
  const leader = week.winner ?? week.rows[0] ?? null
  const called = rightGuesses(predictions, lastWeek)
  const lastPicks = predictions.filter((p) => p.week_key === lastWeek.weekKey)

  async function pick(id: string) {
    if (!me) return
    setBusy(id)
    try {
      await api.makePrediction(id, me.id)
      await qc.invalidateQueries({ queryKey: keys.predictions })
      toast.success(`Your pick: ${league.nameOf(id)}`)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <SectionTitle title="Who'll be Player of the Week?" />
      <div className="card space-y-4 p-4">
        {picking.open ? (
          <>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {squad.map((p) => {
                const chosen = mine?.pick_id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void pick(p.id)}
                    aria-pressed={chosen}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl border p-2 text-[11px] font-semibold transition ${
                      chosen ? 'border-gold/60 bg-gold/10 text-ink' : 'border-line text-ink-2 hover:border-line-strong'
                    }`}
                  >
                    <Avatar league={league} id={p.id} size={40} ring={chosen ? 'gold' : undefined} />
                    <span className="max-w-full truncate">{p.name}</span>
                    {chosen && <Check className="absolute top-1 right-1 h-3.5 w-3.5 text-gold" aria-label="Your pick" />}
                  </button>
                )
              })}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Picks close {shortDate(new Date(picking.closesAt.getTime() - 60_000), league.tz)} at {clockTime(new Date(picking.closesAt.getTime() - 60_000), league.tz)} ·{' '}
              {thisWeek.length} of {squad.length} in · everyone's picks show after that
            </p>
          </>
        ) : thisWeek.length ? (
          <>
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
              <Eye className="h-3.5 w-3.5" aria-hidden /> This week's picks
            </div>
            <ul className="space-y-2">
              {thisWeek.map((p) => {
                const onCourse = leader?.playerId === p.pick_id
                return (
                  <li key={p.player_id} className="flex items-center gap-2.5 text-sm">
                    <Avatar league={league} id={p.player_id} size={26} />
                    <span className="min-w-0 truncate font-semibold">{league.nameOf(p.player_id)}</span>
                    <span className="text-muted">picked</span>
                    <Avatar league={league} id={p.pick_id} size={26} ring={onCourse ? 'gold' : undefined} />
                    <span className="min-w-0 truncate">{league.nameOf(p.pick_id)}</span>
                    {onCourse && <Crown className="h-3.5 w-3.5 shrink-0 text-gold" aria-label="Leading right now" />}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">Nobody made a pick this week. Picks open again on Monday.</p>
        )}

        {lastWeek.winner && lastPicks.length > 0 && (
          <p className="border-t border-line/70 pt-3 text-sm text-ink-2">
            Last week {league.nameOf(lastWeek.winner.playerId)} won.{' '}
            {called.length ? <>Called it: {called.map(league.nameOf).join(', ')} 🔮</> : 'Nobody called it.'}
          </p>
        )}

        {oracle.length > 0 && (
          <div className="border-t border-line/70 pt-3">
            <div className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Prediction table</div>
            <ol className="space-y-1.5">
              {oracle.slice(0, 5).map((r, i) => (
                <li key={r.playerId} className="flex items-center gap-2.5 text-sm">
                  <span className={`w-4 text-center text-xs font-semibold tabular-nums ${i === 0 ? 'text-gold' : 'text-muted'}`}>{i + 1}</span>
                  <Avatar league={league} id={r.playerId} size={24} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{league.nameOf(r.playerId)}</span>
                  {r.streak > 1 && <span className="text-xs text-ember">🔥 {r.streak} in a row</span>}
                  <span className="text-xs text-muted tabular-nums">
                    {r.right} of {r.made} right
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}
