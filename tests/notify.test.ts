// The server's checks on notifications (api/notify.ts).
import { describe, expect, it } from 'vitest'
import { pick, validate, type Message } from '../api/notify'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

const good = { key: 'match:abc:players', topic: 'results', title: 'Abhi logged a result', body: 'Abhi 3–1 Bala', url: '/match/abc', to: [B] }

describe('notify: checking messages', () => {
  it('accepts a well-formed message', () => {
    expect(validate(good)).toMatchObject({ key: 'match:abc:players', to: [B] })
    expect(validate({ ...good, to: 'all' })).toMatchObject({ to: 'all' })
  })

  it('refuses links off the site, unknown topics, long text and odd recipients', () => {
    expect(validate({ ...good, url: 'https://evil.example' })).toMatch(/page of this site/)
    expect(validate({ ...good, url: '//evil.example' })).toMatch(/page of this site/)
    expect(validate({ ...good, topic: 'ads' })).toBe('Bad topic')
    expect(validate({ ...good, title: 'x'.repeat(81) })).toMatch(/Title/)
    expect(validate({ ...good, body: '' })).toMatch(/Body/)
    expect(validate({ ...good, to: ['not-an-id'] })).toBe('Bad recipients')
    expect(validate({ ...good, key: 'has spaces' })).toBe('Bad key')
    expect(validate(null)).toMatch(/JSON/)
  })
})

describe('notify: choosing phones', () => {
  const players = [
    { id: A, user_id: 'u1', active: true },
    { id: B, user_id: 'u2', active: true },
    { id: C, user_id: 'u3', active: false },
  ]
  const phone = (player_id: string, topics: string[], n = 1) => ({ endpoint: `https://push.example/${player_id}/${n}`, player_id, p256dh: 'k', auth: 'a', topics })
  const subs = [phone(A, ['results', 'winners']), phone(B, ['winners']), phone(B, ['results'], 2), phone(C, ['results', 'winners'])]

  it('sends to the recipients phones that want the topic, never the sender or inactive players', () => {
    const toAll: Message = { ...(validate({ ...good, topic: 'winners', to: 'all' }) as Message) }
    expect(pick(toAll, players, subs, A).map((s) => s.endpoint)).toEqual([`https://push.example/${B}/1`])
    const toB = validate(good) as Message
    expect(pick(toB, players, subs, A).map((s) => s.endpoint)).toEqual([`https://push.example/${B}/2`])
    expect(pick(toB, players, subs, B)).toEqual([])
  })
})
