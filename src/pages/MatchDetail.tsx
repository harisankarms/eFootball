import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, CalendarDays, ChevronRight, CircleCheck, Flag, ImageOff, Maximize2, Pencil, SearchX, Trash, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { MatchComments } from '../components/Comments'
import { Lightbox } from '../components/Lightbox'
import { useToast } from '../components/Toast'
import { BackButton, Button, EmptyState, ErrorState, PageSkeleton, Sheet, buttonClass } from '../components/ui'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { keys, useAuth, useLeague, useNow, type League } from '../lib/queries'
import { involves, winnerOf } from '../lib/stats'
import { clockTime, longDate, relativeTime } from '../lib/time'

function Side({ league, id, team, won }: { league: League; id: string; team: string | null; won: boolean }) {
  return (
    <Link to={`/players/${id}`} className="flex min-w-0 flex-col items-center gap-2 text-center">
      <Avatar league={league} id={id} size={64} ring={won ? 'accent' : undefined} />
      <div className="w-full min-w-0">
        <div className={`truncate font-display text-2xl leading-tight font-bold uppercase italic ${won ? 'text-ink' : 'text-ink-2'}`}>
          {league.nameOf(id)}
        </div>
        {team && <div className="truncate text-xs text-muted">{team}</div>}
      </div>
    </Link>
  )
}

export default function MatchDetail() {
  const { id } = useParams()
  const { league, error, refetch } = useLeague()
  const { me, isAdmin } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const now = useNow()
  const [sheet, setSheet] = useState<'dispute' | 'delete' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(false)

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league) return <PageSkeleton />

  const m = league.matches.find((x) => x.id === id)
  if (!m) {
    return (
      <EmptyState icon={SearchX} title="Match not found">
        <p>It may have been deleted.</p>
        <Link to="/matches" className={buttonClass('secondary', 'md', 'mt-5')}>
          Back to matches
        </Link>
      </EmptyState>
    )
  }

  const { settings, tz, nameOf } = league
  const winner = winnerOf(m)
  const full = api.imageUrl(m.screenshot_path)
  const windowEnds = Date.parse(m.created_at) + settings.dispute_hours * 3600_000
  const inWindow = now.getTime() < windowEnds
  const isMember = !!me?.active
  const canDispute = isMember && m.status === 'ok' && inWindow && involves(m, me!.id) && m.submitted_by !== me!.id
  const canDelete = isAdmin || (isMember && m.submitted_by === me!.id && inWindow)

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    try {
      await action()
      await qc.invalidateQueries({ queryKey: keys.matches })
      toast.success(message)
      setSheet(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.deleteMatch(m!)
      navigate('/matches', { replace: true })
      toast.success('Result deleted')
      await qc.invalidateQueries({ queryKey: keys.matches })
    } catch (e) {
      toast.error(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackButton fallback="/matches" />

      <section className="card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
          <Side league={league} id={m.home_id} team={m.home_team} won={winner === m.home_id} />
          <div className="pt-3 text-center">
            <div className="text-5xl leading-none font-bold tracking-tight tabular-nums">
              {m.home_goals}
              <span className="mx-1.5 text-muted">–</span>
              {m.away_goals}
            </div>
            <div className="mt-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
              {m.pens_winner_id ? `${nameOf(m.pens_winner_id)} won on pens` : 'Full time'}
            </div>
          </div>
          <Side league={league} id={m.away_id} team={m.away_team} won={winner === m.away_id} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-line/70 pt-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {longDate(m.played_at, tz)} · {clockTime(m.played_at, tz)}
          </span>
          {m.submitted_by && (
            <span>
              Logged by {nameOf(m.submitted_by)} {relativeTime(m.created_at, tz, now)}
            </span>
          )}
        </div>
      </section>

      {m.status === 'disputed' && (
        <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/[0.08] p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
          <div>
            <div className="font-semibold text-warn">
              Disputed{m.disputed_by ? ` by ${nameOf(m.disputed_by)}` : ''}
            </div>
            {m.dispute_reason && <p className="mt-1 text-ink-2">“{m.dispute_reason}”</p>}
            <p className="mt-1 text-xs text-muted">This result doesn't count until an admin resolves it.</p>
          </div>
        </div>
      )}

      {full ? (
        <button onClick={() => setZoom(true)} className="group relative block w-full overflow-hidden rounded-2xl border border-line">
          <img src={full} alt="Full-time screenshot" className="w-full" />
          <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden /> View full size
          </span>
        </button>
      ) : (
        <div className="card flex items-center gap-3 p-4 text-sm text-muted">
          <ImageOff className="h-5 w-5" aria-hidden /> No screenshot for this match.
        </div>
      )}
      {zoom && full && <Lightbox src={full} alt="Match screenshot" onClose={() => setZoom(false)} />}

      {m.notes && <p className="card p-4 text-ink-2 italic">“{m.notes}”</p>}

      {(canDispute || canDelete || isAdmin) && (
        <div className="flex flex-wrap gap-2">
          {canDispute && (
            <Button variant="danger" icon={<Flag className="h-4 w-4" />} onClick={() => setSheet('dispute')}>
              Dispute
            </Button>
          )}
          {isAdmin && m.status === 'disputed' && (
            <Button
              variant="primary"
              icon={<CircleCheck className="h-4 w-4" />}
              loading={busy}
              onClick={() => run(() => api.resolveDispute(m.id), 'Dispute resolved: the result counts again')}
            >
              Resolve: result stands
            </Button>
          )}
          {isAdmin && (
            <Link to={`/match/${m.id}/edit`} className={buttonClass('secondary')}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Link>
          )}
          {canDelete && (
            <Button variant="ghost" icon={<Trash className="h-4 w-4" />} onClick={() => setSheet('delete')}>
              Delete
            </Button>
          )}
        </div>
      )}
      {canDispute && (
        <p className="text-xs text-muted">
          Wrong score? You can dispute it until {clockTime(new Date(windowEnds), tz)} {longDate(new Date(windowEnds), tz)}.
        </p>
      )}

      <Link
        to={`/h2h?a=${m.home_id}&b=${m.away_id}`}
        className="card flex items-center gap-3 p-4 text-sm font-semibold transition hover:border-line-strong"
      >
        <ArrowLeftRight className="h-4 w-4 text-accent" aria-hidden />
        Head-to-head: {nameOf(m.home_id)} vs {nameOf(m.away_id)}
        <ChevronRight className="ml-auto h-4 w-4 text-muted" aria-hidden />
      </Link>

      <MatchComments match={m} league={league} />

      <Sheet open={sheet === 'dispute'} onClose={() => setSheet(null)} title="Dispute result">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => api.disputeMatch(m.id, reason), 'Result flagged. The admin will sort it out.')
          }}
        >
          <p className="text-sm text-ink-2">The result stops counting until the admin checks the screenshot and fixes or confirms it.</p>
          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-2">What's wrong? (optional)</span>
            <textarea
              className="field min-h-24"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. It was 2-1, not 3-1"
            />
          </label>
          <Button type="submit" variant="danger" size="lg" className="w-full" loading={busy}>
            Flag as disputed
          </Button>
        </form>
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet(null)} title="Delete result">
        <p className="text-sm text-ink-2">
          Delete {nameOf(m.home_id)} {m.home_goals}–{m.away_goals} {nameOf(m.away_id)} and its screenshot? This can't be undone.
        </p>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={() => setSheet(null)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
