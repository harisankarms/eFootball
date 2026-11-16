// Sends a push notification to squad members' phones. The app calls it after something happens
// (a result logged against you, a dispute, the week's winner, a record, a challenge) with the
// message already written, since the app has the whole league in hand.
//
// Guard rails: only a signed-in squad member can call it, each event (its `key`) only ever goes
// out once, nobody can send more than a handful an hour, messages are short and only open pages
// of this site, and nobody is ever notified about their own action.
//
// Needs, in Vercel's environment variables: VITE_SUPABASE_URL (already there), SUPABASE_SECRET_KEY,
// VITE_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. Without them it answers 503 and the app carries on.
//
// Self-contained on purpose (only the web-push package), so Vercel can run it as it is.

import webpush from 'web-push'

export const TOPICS = ['results', 'all-results', 'disputes', 'winners', 'records', 'challenges'] as const
export type Topic = (typeof TOPICS)[number]

export type Message = {
  /** One per event, e.g. "match:<id>:opponent". The same key is never sent twice. */
  key: string
  topic: Topic
  title: string
  body: string
  /** A page of this site, e.g. "/match/<id>". */
  url: string
  /** Player ids, or everyone in the squad. */
  to: 'all' | string[]
}

const LIMIT_PER_HOUR = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Checks a message from the app, or says what's wrong with it. */
export function validate(input: unknown): Message | string {
  if (!input || typeof input !== 'object') return 'Expected a JSON message'
  const m = input as Record<string, unknown>
  const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
  if (!text(m.key, 120) || !/^[\w:.-]+$/.test(m.key as string)) return 'Bad key'
  if (!TOPICS.includes(m.topic as Topic)) return 'Bad topic'
  if (!text(m.title, 80)) return 'Title must be 1 to 80 characters'
  if (!text(m.body, 200)) return 'Body must be 1 to 200 characters'
  if (!text(m.url, 200) || !(m.url as string).startsWith('/') || (m.url as string).startsWith('//')) return 'The link must be a page of this site'
  const to = m.to === 'all' ? 'all' : Array.isArray(m.to) && m.to.length <= 50 && m.to.every((id) => typeof id === 'string' && UUID.test(id)) ? (m.to as string[]) : null
  if (!to) return 'Bad recipients'
  return { key: m.key as string, topic: m.topic as Topic, title: (m.title as string).trim(), body: (m.body as string).trim(), url: m.url as string, to }
}

type Player = { id: string; user_id: string | null; active: boolean }
type Subscription = { endpoint: string; player_id: string; p256dh: string; auth: string; topics: string[] }

/** The phones that should get a message: the recipients' (never the sender's) that want its topic. */
export function pick(message: Message, players: Player[], subs: Subscription[], senderId: string): Subscription[] {
  const active = new Set(players.filter((p) => p.active).map((p) => p.id))
  const targets = message.to === 'all' ? active : new Set(message.to.filter((id) => active.has(id)))
  targets.delete(senderId)
  return subs.filter((s) => targets.has(s.player_id) && s.topics.includes(message.topic))
}

const env = (name: string) => (process.env[name] ?? '').trim()
const reply = (data: unknown, status = 200) => Response.json(data, { status })

export async function POST(request: Request): Promise<Response> {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY')
  const publicKey = env('VITE_VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  if (!url || !key || !publicKey || !privateKey) return reply({ error: 'Notifications are not set up on the server' }, 503)

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return reply({ error: 'Sign in first' }, 401)

  const db = (path: string, init: RequestInit = {}) =>
    fetch(`${url}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers } })

  // Who is asking: a signed-in account linked to an active squad player.
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
  if (!who.ok) return reply({ error: 'Sign in again' }, 401)
  const userId = ((await who.json()) as { id?: string }).id
  const playersRes = await db('/rest/v1/players?select=id,user_id,active')
  if (!playersRes.ok) return reply({ error: 'Could not read the squad' }, 502)
  const players = (await playersRes.json()) as Player[]
  const sender = players.find((p) => p.user_id === userId && p.active)
  if (!sender) return reply({ error: 'Only squad members can send notifications' }, 403)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const message = validate(body)
  if (typeof message === 'string') return reply({ error: message }, 400)

  // A handful an hour per person is plenty.
  const since = new Date(Date.now() - 3600_000).toISOString()
  const recent = await db(`/rest/v1/notifications_sent?select=key&sender_id=eq.${sender.id}&sent_at=gte.${encodeURIComponent(since)}`, {
    headers: { Prefer: 'count=exact', Range: '0-0' },
  })
  const count = Number(recent.headers.get('content-range')?.split('/')[1] ?? 0)
  if (count >= LIMIT_PER_HOUR) return reply({ error: 'Too many notifications this hour' }, 429)

  // Each event goes out once, however many phones ask.
  const claim = await db('/rest/v1/notifications_sent?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ key: message.key, sender_id: sender.id }),
  })
  if (!claim.ok) return reply({ error: 'Could not record the notification' }, 502)
  if (((await claim.json()) as unknown[]).length === 0) return reply({ sent: 0, duplicate: true })

  const subsRes = await db('/rest/v1/push_subscriptions?select=endpoint,player_id,p256dh,auth,topics')
  if (!subsRes.ok) return reply({ error: 'Could not read who wants notifications' }, 502)
  const phones = pick(message, players, (await subsRes.json()) as Subscription[], sender.id)

  webpush.setVapidDetails(env('VAPID_SUBJECT') || new URL(request.url).origin, publicKey, privateKey)
  const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: message.key })
  const results = await Promise.allSettled(
    phones.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400 })),
  )

  // Phones that uninstalled the app or turned notifications off answer 404 or 410: forget them.
  const gone = phones.filter((_, i) => {
    const r = results[i]
    return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
  })
  await Promise.all(gone.map((s) => db(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' })))

  const sent = results.filter((r) => r.status === 'fulfilled').length
  await db(`/rest/v1/notifications_sent?key=eq.${encodeURIComponent(message.key)}`, { method: 'PATCH', body: JSON.stringify({ recipients: sent }) })
  return reply({ sent, phones: phones.length, removed: gone.length })
}
