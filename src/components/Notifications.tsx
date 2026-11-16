import { Bell, BellOff, BellRing, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { friendlyError } from '../lib/api'
import { DEFAULT_TOPICS, TOPICS, pushStatus, setTopics, turnOff, turnOn, type PushState, type Topic } from '../lib/push'
import { useAuth } from '../lib/queries'
import { useToast } from './Toast'
import { Button, GlowIcon, Sheet, Toggle } from './ui'

const NOTES: Partial<Record<PushState, string>> = {
  unavailable: "Notifications work on the live site once it's set up.",
  unsupported: "This browser can't show notifications. Open the site in Chrome, or install it to your home screen.",
  blocked: 'Notifications are blocked for this site. Allow them in your phone settings (for the browser or the installed app), then come back here.',
}

/** Turning notifications on or off for this phone, and choosing which kinds. */
export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [state, setState] = useState<PushState | null>(null)
  const [topics, setChosen] = useState<Topic[]>(DEFAULT_TOPICS)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setState(null)
    void pushStatus().then((s) => {
      if (!alive) return
      setState(s.state)
      if (s.state === 'on') setChosen(s.topics)
    })
    return () => {
      alive = false
    }
  }, [open])

  async function enable() {
    setBusy(true)
    try {
      const next = await turnOn(topics)
      setState(next)
      if (next === 'on') toast.success("Notifications are on. You'll hear about the things you picked.")
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      await turnOff()
      setState('off')
      toast.success('Notifications are off on this phone')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(id: Topic, on: boolean) {
    const next = on ? [...topics, id] : topics.filter((t) => t !== id)
    setChosen(next)
    if (state !== 'on') return
    try {
      await setTopics(next)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      {state === null ? (
        <p className="py-6 text-center text-sm text-muted">Checking this phone…</p>
      ) : state === 'install' ? (
        <div className="space-y-3 text-sm text-ink-2">
          <p>On iPhone and iPad, notifications only work in the app on your Home Screen:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Tap <Share className="inline h-4 w-4 align-[-3px]" aria-label="Share" /> in Safari, then <b className="text-ink">Add to Home Screen</b>.
            </li>
            <li>Open the app from your Home Screen and sign in.</li>
            <li>Come back here and turn notifications on.</li>
          </ol>
        </div>
      ) : NOTES[state] ? (
        <p className="text-sm text-ink-2">{NOTES[state]}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <GlowIcon icon={state === 'on' ? BellRing : Bell} tint={state === 'on' ? 'accent' : 'neutral'} />
            <div className="text-sm">
              <div className="font-semibold">{state === 'on' ? 'On for this phone' : 'Off on this phone'}</div>
              <div className="text-muted">Pick what you want to hear about.</div>
            </div>
          </div>
          <ul className="divide-y divide-line/70 rounded-2xl border border-line">
            {TOPICS.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="text-xs text-muted">{t.hint}</div>
                </div>
                <Toggle checked={topics.includes(t.id)} onChange={(v) => void toggle(t.id, v)} label={t.label} />
              </li>
            ))}
          </ul>
          {state === 'on' ? (
            <Button className="w-full" icon={<BellOff className="h-4 w-4" />} loading={busy} onClick={() => void disable()}>
              Turn off on this phone
            </Button>
          ) : (
            <Button variant="primary" size="lg" className="w-full" icon={<Bell className="h-5 w-5" />} loading={busy} disabled={!topics.length} onClick={() => void enable()}>
              Turn on notifications
            </Button>
          )}
          <p className="text-xs text-muted">Each phone is set up on its own. You'll never get a notification about something you did yourself.</p>
        </div>
      )}
    </Sheet>
  )
}

const PROMPT = 'eft-push-prompt'

/** A one-time nudge on Home for members whose phone could get notifications but doesn't yet. */
export function NotificationsPrompt() {
  const { isMember } = useAuth()
  const [state, setState] = useState<PushState | null>(null)
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(PROMPT) === 'dismissed'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!isMember || hidden) return
    let alive = true
    void pushStatus().then((s) => alive && setState(s.state))
    return () => {
      alive = false
    }
  }, [isMember, hidden, open])

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(PROMPT, 'dismissed')
    } catch {
      // Private mode: it'll ask again next visit.
    }
  }

  if (!isMember || hidden || (state !== 'off' && state !== 'install')) return <NotificationsSheet open={open} onClose={() => setOpen(false)} />
  return (
    <>
      <div className="card flex items-center gap-3 border-accent/25 p-3.5">
        <GlowIcon icon={Bell} tint="accent" size="sm" />
        <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold">Get notified</span>
          <span className="block text-xs text-muted">
            {state === 'install' ? 'Add the app to your Home Screen to get a ping for results, challenges and winners.' : 'A ping when someone logs a result against you, challenges you, or wins the week.'}
          </span>
        </button>
        <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
          {state === 'install' ? 'How' : 'Turn on'}
        </Button>
        <button type="button" onClick={dismiss} aria-label="Not now" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <NotificationsSheet
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      />
    </>
  )
}
