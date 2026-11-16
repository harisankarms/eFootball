// Push notifications on this phone: turning them on and off, choosing which kinds, and asking
// the site's server (api/notify.ts) to send one to the squad.

import { api } from './backend'

export type Topic = 'results' | 'all-results' | 'disputes' | 'winners' | 'records' | 'challenges'

/** What a notification says and who gets it (the server checks all of it). */
export type PushMessage = {
  /** One per event: the same key is never sent twice, however many phones ask. */
  key: string
  topic: Topic
  title: string
  body: string
  /** The page to open, e.g. "/match/<id>". */
  url: string
  /** Player ids, or the whole squad. The sender is never notified. */
  to: 'all' | string[]
}

export const TOPICS: { id: Topic; label: string; hint: string; on: boolean }[] = [
  { id: 'results', label: 'Results against you', hint: 'When someone logs a game you played in', on: true },
  { id: 'disputes', label: 'Disputes', hint: 'When your result is disputed, or a dispute is settled', on: true },
  { id: 'challenges', label: 'Challenges', hint: 'When someone challenges you, or answers your challenge', on: true },
  { id: 'winners', label: 'Winners', hint: 'Player of the Week, of the Month and of the Season', on: true },
  { id: 'records', label: 'Records', hint: 'When a group record falls', on: true },
  { id: 'all-results', label: 'Every result', hint: 'Every game anyone logs', on: false },
]

export const DEFAULT_TOPICS = TOPICS.filter((t) => t.on).map((t) => t.id)

const PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? ''

export type PushState =
  /** This browser can't do push at all. */
  | 'unsupported'
  /** An iPhone or iPad: push only works in the app added to the Home Screen. */
  | 'install'
  /** The site isn't set up for push (no key), or this is the demo. */
  | 'unavailable'
  /** The person said no in the browser's own prompt; only their settings can undo it. */
  | 'blocked'
  | 'off'
  | 'on'

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** The push address the browser has for this site, if any. */
async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Where this phone stands, and which kinds it gets when it's on. */
export async function pushStatus(): Promise<{ state: PushState; topics: Topic[] }> {
  if (api.mode === 'demo' || !PUBLIC_KEY) return { state: 'unavailable', topics: [] }
  if (!supported()) return { state: isIos() && !isInstalled() ? 'install' : 'unsupported', topics: [] }
  if (Notification.permission === 'denied') return { state: 'blocked', topics: [] }
  const sub = await currentSubscription()
  if (!sub || Notification.permission !== 'granted') return { state: 'off', topics: [] }
  const topics = (await api.getPushTopics(sub.endpoint).catch(() => null)) as Topic[] | null
  return topics ? { state: 'on', topics } : { state: 'off', topics: [] }
}

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/** Asks the browser for permission (must run from a tap) and saves this phone for the signed-in player. */
export async function turnOn(topics: Topic[]): Promise<PushState> {
  if (!supported() || !PUBLIC_KEY) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }))
  await save(sub, topics)
  return 'on'
}

async function save(sub: PushSubscription, topics: Topic[]) {
  const json = sub.toJSON()
  await api.savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '', topics })
}

export async function setTopics(topics: Topic[]) {
  const sub = await currentSubscription()
  if (sub) await save(sub, topics)
}

export async function turnOff() {
  const sub = await currentSubscription()
  if (!sub) return
  await api.removePushSubscription(sub.endpoint).catch(() => undefined)
  await sub.unsubscribe().catch(() => false)
}

const ASKED = 'eft-notified'

/**
 * Asks the server to send these messages. Never throws and never waits on anything that
 * matters: a notification that can't go out (offline, not set up) is simply skipped.
 */
export function sendPush(messages: PushMessage[]) {
  if (api.mode === 'demo' || !messages.length) return
  void (async () => {
    // Each phone asks about an event once; the server sends it once whoever asks first.
    let asked: string[] = []
    try {
      asked = JSON.parse(localStorage.getItem(ASKED) ?? '[]') as string[]
    } catch {
      asked = []
    }
    const fresh = messages.filter((m) => !asked.includes(m.key))
    if (!fresh.length) return
    const token = await api.accessToken().catch(() => null)
    if (!token) return
    for (const m of fresh) {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(m),
      }).catch(() => null)
      // Not set up yet (503) or offline: try again another time.
      if (!res || res.status === 503 || res.status >= 500) return
      asked.push(m.key)
    }
    try {
      localStorage.setItem(ASKED, JSON.stringify(asked.slice(-200)))
    } catch {
      // Private mode: the server's once-only check still holds.
    }
  })()
}
