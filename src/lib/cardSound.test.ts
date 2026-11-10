import { describe, expect, it } from 'vitest'
import { createSoundController, type AudioLike } from './cardSound'

type FakeAudio = AudioLike & { url: string; paused: boolean; plays: number }

function setup({ startOn = false, refuse = false, missing = '' } = {}) {
  const audios: FakeAudio[] = []
  let blockedCalls = 0
  const failures: string[] = []
  const saved: boolean[] = []
  const controller = createSoundController({
    startOn,
    save: (on) => saved.push(on),
    onBlocked: () => blockedCalls++,
    onFailed: (url) => failures.push(url),
    makeAudio: (url) => {
      const a: FakeAudio = {
        url,
        volume: 1,
        paused: true,
        plays: 0,
        play() {
          a.plays++
          if (url === missing) return Promise.reject(Object.assign(new Error('no supported sources'), { name: 'NotSupportedError' }))
          if (refuse) return Promise.reject(Object.assign(new Error('needs a tap'), { name: 'NotAllowedError' }))
          a.paused = false
          return Promise.resolve()
        },
        pause() {
          a.paused = true
        },
      }
      audios.push(a)
      return a
    },
  })
  const playing = () => audios.filter((a) => !a.paused).map((a) => a.url)
  return { controller, audios, playing, saved, failures, blockedCalls: () => blockedCalls, allowTaps: () => (refuse = false) }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('card sound', () => {
  it('stays silent until the speaker is tapped, then plays that card', async () => {
    const { controller, playing, saved } = setup()
    controller.add('potw', '/potw.mp3')
    controller.seen('potw', 1)
    await settle()
    expect(playing()).toEqual([])
    expect(controller.snapshot().on).toBe(false)

    controller.toggle('potw')
    await settle()
    expect(playing()).toEqual(['/potw.mp3'])
    expect(controller.snapshot()).toEqual({ on: true, playing: '/potw.mp3', blocked: false, failed: null })
    expect(saved).toEqual([true])

    controller.toggle('potw')
    await settle()
    expect(playing()).toEqual([])
    expect(controller.snapshot().on).toBe(false)
  })

  it('plays one card at a time and follows the one on screen', async () => {
    const { controller, playing } = setup()
    controller.add('potw', '/potw.mp3')
    controller.add('chenda', '/chenda.mp3')
    controller.seen('potw', 1)
    controller.seen('chenda', 0.1)
    controller.toggle('potw')
    await settle()
    expect(playing()).toEqual(['/potw.mp3'])

    // Scrolling down: the tapped card keeps playing until it's mostly gone, then the chenda card takes over.
    controller.seen('chenda', 0.8)
    controller.seen('potw', 0.4)
    await settle()
    expect(playing()).toEqual(['/potw.mp3'])
    controller.seen('potw', 0.1)
    await settle()
    expect(playing()).toEqual(['/chenda.mp3'])

    // Nothing big enough on screen: quiet, but sound stays on for when a card comes back.
    controller.seen('chenda', 0.2)
    await settle()
    expect(playing()).toEqual([])
    expect(controller.snapshot().on).toBe(true)
    controller.seen('potw', 0.9)
    await settle()
    expect(playing()).toEqual(['/potw.mp3'])
  })

  it("tapping the speaker on a card that isn't playing switches to it; on the playing card it mutes", async () => {
    const { controller, playing } = setup()
    controller.add('potw', '/potw.mp3')
    controller.add('chenda', '/chenda.mp3')
    controller.seen('potw', 1)
    controller.seen('chenda', 1)
    controller.toggle('potw')
    await settle()
    expect(playing()).toEqual(['/potw.mp3'])

    controller.toggle('chenda')
    await settle()
    expect(playing()).toEqual(['/chenda.mp3'])
    expect(controller.snapshot().on).toBe(true)

    controller.toggle('chenda')
    await settle()
    expect(playing()).toEqual([])
    expect(controller.snapshot().on).toBe(false)
  })

  it('stops when the app goes to the background or the card leaves the page', async () => {
    const { controller, playing } = setup()
    controller.add('potw', '/potw.mp3')
    controller.seen('potw', 1)
    controller.toggle('potw')
    await settle()
    controller.setPageVisible(false)
    await settle()
    expect(playing()).toEqual([])
    controller.setPageVisible(true)
    await settle()
    expect(playing()).toEqual(['/potw.mp3'])
    controller.remove('potw')
    await settle()
    expect(playing()).toEqual([])
  })

  it('after a reload with sound on, waits for a tap instead of failing', async () => {
    const { controller, playing, blockedCalls, allowTaps } = setup({ startOn: true, refuse: true })
    controller.add('potw', '/potw.mp3')
    controller.seen('potw', 1)
    await settle()
    expect(controller.snapshot()).toEqual({ on: true, playing: null, blocked: true, failed: null })
    expect(blockedCalls()).toBe(1)

    allowTaps()
    controller.tapped()
    await settle()
    expect(playing()).toEqual(['/potw.mp3'])
    expect(controller.snapshot().blocked).toBe(false)
  })

  it('reports a track that will not load (an old copy of the app asking for a replaced file)', async () => {
    const { controller, playing, failures } = setup({ missing: '/old-potw.mp3' })
    controller.add('potw', '/old-potw.mp3')
    controller.add('chenda', '/chenda.mp3')
    controller.seen('potw', 1)
    controller.toggle('potw')
    await settle()
    expect(playing()).toEqual([])
    expect(failures).toEqual(['/old-potw.mp3'])
    expect(controller.snapshot()).toEqual({ on: true, playing: null, blocked: false, failed: '/old-potw.mp3' })

    // Another card's track still plays.
    controller.seen('potw', 0)
    controller.seen('chenda', 1)
    await settle()
    expect(playing()).toEqual(['/chenda.mp3'])
  })

  it('a tap on the speaker while waiting starts the sound rather than muting it', async () => {
    const { controller, playing, allowTaps } = setup({ startOn: true, refuse: true })
    controller.add('chenda', '/chenda.mp3')
    controller.seen('chenda', 1)
    await settle()
    allowTaps()
    controller.toggle('chenda')
    await settle()
    expect(playing()).toEqual(['/chenda.mp3'])
    expect(controller.snapshot().on).toBe(true)
  })
})
