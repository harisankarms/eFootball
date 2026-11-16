import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Plus, Swords, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { liveChallenges, type ChallengeState } from '../lib/challenges'
import { answerMessage, challengeMessage, scoreLine } from '../lib/notifications'
import { sendPush } from '../lib/push'
import { keys, useAuth, useChallenges, type League } from '../lib/queries'
import { relativeTime } from '../lib/time'
import type { Challenge } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { Button, GlowIcon, SectionTitle, Sheet, buttonClass } from './ui'

/** Sending a challenge: pick who, add a line if you like. */
export function ChallengeSheet({ league, open, onClose, preset }: { league: League; open: boolean; onClose: () => void; preset?: string | null }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { me } = useAuth()
  const [to, setTo] = useState<string | null>(preset ?? null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const rivals = league.players.filter((p) => p.active && p.id !== me?.id)
  const chosen = to ?? preset ?? null

  async function send() {
    if (!me || !chosen) return
    setBusy(true)
    try {
      const c = await api.sendChallenge(chosen, message, me.id)
      sendPush([challengeMessage(league, c)])
      await qc.invalidateQueries({ queryKey: keys.challenges })
      toast.success(`Challenge sent to ${league.nameOf(chosen)}`)
      setMessage('')
      setTo(null)
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Challenge someone">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {rivals.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setTo(p.id)}
              aria-pressed={chosen === p.id}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-xs font-semibold transition ${
                chosen === p.id ? 'border-accent/60 bg-accent/10 text-ink' : 'border-line text-ink-2 hover:border-line-strong'
              }`}
            >
              <Avatar league={league} id={p.id} size={44} ring={chosen === p.id ? 'gradient' : undefined} />
              <span className="max-w-full truncate">{p.name}</span>
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">Say something (optional)</span>
          <input className="field" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Rematch tonight? Bring your best team." />
        </label>
        <Button variant="primary" size="lg" className="w-full" icon={<Swords className="h-5 w-5" />} loading={busy} disabled={!chosen} onClick={() => void send()}>
          {chosen ? `Challenge ${league.nameOf(chosen)}` : 'Pick who to challenge'}
        </Button>
      </div>
    </Sheet>
  )
}

function stateLine(league: League, c: Challenge, state: ChallengeState, now: Date) {
  switch (state.kind) {
    case 'waiting':
      return `Waiting for ${league.nameOf(c.to_id)} · ${relativeTime(c.created_at, league.tz, now)}`
    case 'game-on':
      return 'Accepted: game on'
    case 'played':
      return `Settled: ${scoreLine(league, state.match)}`
    case 'declined':
      return `${league.nameOf(c.to_id)} declined`
    default:
      return ''
  }
}

/** Challenges on Home: ones waiting for you, yours, games on, and the squad's. */
export function ChallengesSection({ league, now }: { league: League; now: Date }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { me, isMember } = useAuth()
  const { data } = useChallenges()
  const [composing, setComposing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // A notification about a challenge opens Home at this section.
  useEffect(() => {
    if (data && window.location.hash === '#challenges') document.getElementById('challenges')?.scrollIntoView({ block: 'start' })
  }, [data])
  if (!isMember || !me) return null

  const live = liveChallenges(data ?? [], league.matches, now)
  // Waiting for me first, then games on involving me, then everything else.
  const weight = ({ challenge: c, state }: (typeof live)[number]) =>
    state.kind === 'waiting' && c.to_id === me.id ? 0 : state.kind === 'game-on' && (c.from_id === me.id || c.to_id === me.id) ? 1 : state.kind === 'waiting' ? 2 : state.kind === 'game-on' ? 3 : 4
  live.sort((a, b) => weight(a) - weight(b))

  async function answer(c: Challenge, status: 'accepted' | 'declined' | 'cancelled') {
    setBusy(c.id)
    try {
      await api.answerChallenge(c.id, status)
      if (status !== 'cancelled') sendPush([answerMessage(league, c, status)])
      await qc.invalidateQueries({ queryKey: keys.challenges })
      toast.success(status === 'accepted' ? "Game on! Log the result when you've played." : status === 'declined' ? 'Challenge declined' : 'Challenge called off')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section id="challenges" className="scroll-mt-24">
      <SectionTitle
        title="Challenges"
        action={
          <button onClick={() => setComposing(true)} className="flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-cyan">
            <Plus className="h-4 w-4" aria-hidden /> Challenge
          </button>
        }
      />
      {live.length === 0 ? (
        <button onClick={() => setComposing(true)} className="card card-hover flex w-full items-center gap-3 p-4 text-left">
          <GlowIcon icon={Swords} tint="ember" />
          <div>
            <div className="font-semibold">Challenge someone</div>
            <div className="text-xs text-muted">Call someone out. They accept or decline, and the next game between you settles it.</div>
          </div>
        </button>
      ) : (
        <div className="space-y-2.5">
          {live.slice(0, 5).map(({ challenge: c, state }) => {
            const forMe = state.kind === 'waiting' && c.to_id === me.id
            const fromMe = state.kind === 'waiting' && c.from_id === me.id
            const mine = c.from_id === me.id || c.to_id === me.id
            const opponent = c.from_id === me.id ? c.to_id : c.from_id
            return (
              <article key={c.id} className={`card p-3.5 ${forMe ? 'border-ember/40' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="flex shrink-0 -space-x-2">
                    <Avatar league={league} id={c.from_id} size={34} className="ring-2 ring-surface" />
                    <Avatar league={league} id={c.to_id} size={34} className="ring-2 ring-surface" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {league.nameOf(c.from_id)} <span className="text-muted">challenged</span> {league.nameOf(c.to_id)}
                    </div>
                    <div className="truncate text-xs text-muted">{stateLine(league, c, state, now)}</div>
                  </div>
                  {state.kind === 'played' && (
                    <Link to={`/match/${state.match.id}`} aria-label="Open the result" className="text-muted hover:text-ink">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
                {c.message && <p className="mt-2 text-sm text-ink-2 italic">“{c.message}”</p>}
                {forMe && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="primary" icon={<Check className="h-4 w-4" />} loading={busy === c.id} onClick={() => void answer(c, 'accepted')}>
                      Accept
                    </Button>
                    <Button size="sm" icon={<X className="h-4 w-4" />} disabled={busy === c.id} onClick={() => void answer(c, 'declined')}>
                      Decline
                    </Button>
                  </div>
                )}
                {fromMe && (
                  <div className="mt-3">
                    <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => void answer(c, 'cancelled')}>
                      Call it off
                    </Button>
                  </div>
                )}
                {state.kind === 'game-on' && mine && (
                  <Link to={`/add?home=${me.id}&away=${opponent}`} className={buttonClass('secondary', 'sm', 'mt-3')}>
                    <Plus className="h-4 w-4" aria-hidden /> Log the result
                  </Link>
                )}
              </article>
            )
          })}
        </div>
      )}
      <ChallengeSheet league={league} open={composing} onClose={() => setComposing(false)} />
    </section>
  )
}
