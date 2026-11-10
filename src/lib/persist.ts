import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query'
import type { Session } from './types'

/**
 * Keeps the last-loaded league on the phone, so the app opens straight onto the results
 * and refreshes them in the background instead of showing loading boxes every time.
 * Members only, and wiped on sign-out.
 */
const KEY = 'eft-saved-league'
/** After two weeks away, start fresh. */
const MAX_AGE = 14 * 24 * 3600_000
/** Browsers allow about 5 MB per site; stay well under it. */
const MAX_CHARS = 2_500_000
/** The queries worth saving: everything a page needs to draw, nothing admin-only. */
const SAVED = new Set(['players', 'matches', 'settings', 'achievements', 'awards', 'announcements', 'comments', 'tournaments', 'me'])

type Saved = { version: string; owner: Session; savedAt: number; state: DehydratedState }

function remove() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Storage blocked (private mode): nothing was saved anyway.
  }
}

/** Puts the saved league back into the cache. Returns whose it is, or null if there's nothing usable. */
export function restoreSaved(client: QueryClient): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    if (saved.version !== __CACHE_VERSION__ || !saved.owner?.userId || !(Date.now() - saved.savedAt < MAX_AGE)) {
      remove()
      return null
    }
    hydrate(client, saved.state)
    return saved.owner
  } catch {
    remove()
    return null
  }
}

function write(client: QueryClient, owner: Session) {
  const state = dehydrate(client, {
    shouldDehydrateQuery: (q) => q.state.status === 'success' && SAVED.has(String(q.queryKey[0])),
  })
  const raw = JSON.stringify({ version: __CACHE_VERSION__, owner, savedAt: Date.now(), state } satisfies Saved)
  if (raw.length > MAX_CHARS) return remove()
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    remove()
  }
}

/**
 * Saves the league a second after each refresh and when the app goes to the background,
 * for as long as `canSave` says the owner is still a squad member. Returns a stop function.
 */
export function keepSaving(client: QueryClient, owner: Session, canSave: () => boolean): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    clearTimeout(timer)
    timer = undefined
    if (canSave()) write(client, owner)
  }
  const soon = () => {
    if (!timer) timer = setTimeout(save, 1000)
  }
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') soon()
  })
  const onHide = () => {
    if (document.visibilityState === 'hidden' && timer) save()
  }
  document.addEventListener('visibilitychange', onHide)
  soon()
  return () => {
    unsubscribe()
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onHide)
  }
}

/** Deletes the saved copy only, for someone who is no longer a squad member. */
export const dropSaved = remove

/** Forgets everything: the saved copy and what's in memory. */
export function forgetSaved(client: QueryClient) {
  remove()
  client.clear()
}
