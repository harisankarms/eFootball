import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetSaved, keepSaving, restoreSaved } from './persist'

const owner = { userId: 'u1', email: 'leo@example.com' }
const KEY = 'eft-saved-league'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

let storage: ReturnType<typeof fakeStorage>

beforeEach(() => {
  vi.useFakeTimers()
  storage = fakeStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function savedClient() {
  const client = new QueryClient()
  const stop = keepSaving(client, owner, () => true)
  await client.fetchQuery({ queryKey: ['matches'], queryFn: async () => [{ id: 'm1' }] })
  await client.fetchQuery({ queryKey: ['join-requests'], queryFn: async () => [{ user_id: 'x' }] })
  vi.advanceTimersByTime(1500)
  stop()
  return client
}

describe('saved league', () => {
  it('saves league queries a moment after they load, and puts them back with their owner', async () => {
    await savedClient()
    const fresh = new QueryClient()
    expect(restoreSaved(fresh)).toEqual(owner)
    expect(fresh.getQueryData(['matches'])).toEqual([{ id: 'm1' }])
    // Admin-only lists stay off the phone.
    expect(fresh.getQueryData(['join-requests'])).toBeUndefined()
  })

  it("doesn't save for someone who isn't a member", async () => {
    const client = new QueryClient()
    const stop = keepSaving(client, owner, () => false)
    await client.fetchQuery({ queryKey: ['matches'], queryFn: async () => [] })
    vi.advanceTimersByTime(1500)
    stop()
    expect(storage.data.has(KEY)).toBe(false)
  })

  it('throws away a copy from another app version or more than two weeks old', async () => {
    await savedClient()
    const saved = JSON.parse(storage.data.get(KEY)!)
    storage.setItem(KEY, JSON.stringify({ ...saved, version: 'older' }))
    expect(restoreSaved(new QueryClient())).toBeNull()
    expect(storage.data.has(KEY)).toBe(false)

    storage.setItem(KEY, JSON.stringify({ ...saved, savedAt: Date.now() - 15 * 24 * 3600_000 }))
    expect(restoreSaved(new QueryClient())).toBeNull()
  })

  it('survives a broken saved copy', () => {
    storage.setItem(KEY, '{not json')
    expect(restoreSaved(new QueryClient())).toBeNull()
    expect(storage.data.has(KEY)).toBe(false)
  })

  it('forgets everything on sign-out', async () => {
    const client = await savedClient()
    forgetSaved(client)
    expect(storage.data.has(KEY)).toBe(false)
    expect(client.getQueryData(['matches'])).toBeUndefined()
  })
})
