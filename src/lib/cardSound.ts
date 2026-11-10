/*
 * Background sound for the big cards, like Instagram: muted until you tap the speaker, then
 * on for the rest of the visit. Only one card plays at a time, the one you tapped or else the
 * one most on screen, and it stops when you scroll away, leave the page or switch apps.
 *
 * Tracks live in src/assets/sounds/ (see the README there): potw.mp3 for the Player of the Week
 * card and chenda.mp3 for the chenda card. A card only shows its speaker once its file exists.
 */

export type SoundName = 'potw' | 'chenda'

const FILES = import.meta.glob('../assets/sounds/*.{mp3,m4a,aac,ogg,opus,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** The track for a card, or null if nobody has added one yet. */
export function soundUrl(name: SoundName): string | null {
  const key = Object.keys(FILES).find((k) => k.replace(/^.*\//, '').replace(/\.[^.]+$/, '').toLowerCase() === name)
  return key ? FILES[key] : null
}

/** The bits of an <audio> element the controller uses (a stand-in in tests). */
export type AudioLike = {
  volume: number
  play(): Promise<void>
  pause(): void
}

export type SoundState = {
  /** The speaker is on (for this visit). */
  on: boolean
  /** The track actually playing right now. */
  playing: string | null
  /** Sound is on but the browser wants a tap first (after a reload). */
  blocked: boolean
}

const VOLUME = 0.6
/** A card needs half of itself on screen to start playing... */
const PLAY_AT = 0.5
/** ...but the one you tapped keeps playing until it's mostly scrolled away. */
const KEEP_AT = 0.25

type Options = {
  makeAudio: (url: string) => AudioLike
  startOn?: boolean
  save?: (on: boolean) => void
  /** Fade in and out over this long (0 in tests). */
  fadeMs?: number
  /** The browser refused to start sound without a tap. */
  onBlocked?: () => void
}

export function createSoundController({ makeAudio, startOn = false, save, fadeMs = 0, onBlocked }: Options) {
  const cards = new Map<string, { url: string; seen: number }>()
  const audios = new Map<string, AudioLike>()
  const fades = new Map<AudioLike, ReturnType<typeof setInterval>>()
  const listeners = new Set<() => void>()
  let on = startOn
  let pageVisible = true
  let preferred: string | null = null
  let current: string | null = null
  let playing: string | null = null
  let blocked = false
  let state: SoundState = { on, playing, blocked }

  const emit = () => {
    if (state.on === on && state.playing === playing && state.blocked === blocked) return
    state = { on, playing, blocked }
    listeners.forEach((f) => f())
  }

  const audioFor = (url: string) => {
    let a = audios.get(url)
    if (!a) {
      a = makeAudio(url)
      audios.set(url, a)
    }
    return a
  }

  function ramp(a: AudioLike, to: number, done?: () => void) {
    clearInterval(fades.get(a))
    fades.delete(a)
    if (fadeMs <= 0) {
      a.volume = to
      done?.()
      return
    }
    const from = a.volume
    const steps = Math.max(1, Math.round(fadeMs / 40))
    let i = 0
    const timer = setInterval(() => {
      i++
      a.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps))
      if (i >= steps) {
        clearInterval(timer)
        fades.delete(a)
        done?.()
      }
    }, 40)
    fades.set(a, timer)
  }

  /** Called straight from the tap that turned sound on, which browsers require. */
  function start(url: string) {
    const a = audioFor(url)
    if (fadeMs > 0 && playing !== url) a.volume = 0
    let attempt: Promise<void>
    try {
      attempt = a.play()
    } catch (e) {
      attempt = Promise.reject(e)
    }
    attempt.then(
      () => {
        if (current !== url) return a.pause()
        playing = url
        blocked = false
        ramp(a, VOLUME)
        emit()
      },
      (e: unknown) => {
        if (current !== url) return
        if (e instanceof Error && e.name === 'NotAllowedError') {
          blocked = true
          emit()
          onBlocked?.()
        }
      },
    )
  }

  function stop(url: string, now: boolean) {
    const a = audios.get(url)
    if (playing === url) playing = null
    if (!a) return
    if (now) {
      ramp(a, 0)
      a.pause()
    } else {
      ramp(a, 0, () => current !== url && a.pause())
    }
  }

  function choose(): string | null {
    if (!on || !pageVisible) return null
    if (preferred) {
      const tapped = cards.get(preferred)
      if (tapped && tapped.seen >= KEEP_AT) return tapped.url
      preferred = null
    }
    let best: { url: string; seen: number } | null = null
    for (const c of cards.values()) if (c.seen >= PLAY_AT && (!best || c.seen > best.seen)) best = c
    return best?.url ?? null
  }

  function update() {
    const next = choose()
    if (next !== current) {
      const previous = current
      current = next
      if (previous) stop(previous, !pageVisible || !on)
      if (next) start(next)
    }
    emit()
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    snapshot: () => state,
    /** A card with a track came on the page. */
    add(id: string, url: string) {
      cards.set(id, { url, seen: 0 })
    },
    remove(id: string) {
      cards.delete(id)
      if (preferred === id) preferred = null
      update()
    },
    /** How much of the card is on screen, from 0 to 1. */
    seen(id: string, ratio: number) {
      const card = cards.get(id)
      if (!card) return
      card.seen = ratio
      update()
    },
    /** The card's speaker was tapped. */
    toggle(id: string) {
      const card = cards.get(id)
      if (on && blocked) {
        // Sound was already on but waiting for a tap: this is that tap, so play rather than mute.
        blocked = false
        preferred = id
        if (card) card.seen = Math.max(card.seen, KEEP_AT)
        if (current) stop(current, true)
        current = null
        update()
        return
      }
      on = !on
      save?.(on)
      preferred = on ? id : null
      if (on && card) card.seen = Math.max(card.seen, KEEP_AT)
      update()
    },
    setPageVisible(visible: boolean) {
      pageVisible = visible
      update()
    },
    /** Any tap on the page: start the track that was waiting for one. */
    tapped() {
      if (!blocked || !current) return
      blocked = false
      start(current)
      emit()
    },
  }
}

export type SoundController = ReturnType<typeof createSoundController>

/*
 * Playing a track. Tracks can be mastered at very different loudness (the first two were 10 dB
 * apart), and iPhones ignore an <audio> element's volume, so each track goes through Web Audio:
 * its loudness is measured once (and remembered), and a gain brings every track to the same level.
 */

/** Every track is brought to this average level (dBFS), never louder than its peaks allow. */
const TARGET_DB = -18
const LEVEL_KEY = 'eft-sound-level:'

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

let context: AudioContext | null | undefined

function audioContext(): AudioContext | null {
  if (context !== undefined) return context
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
  context = Ctor ? new Ctor() : null
  // iPhones: play with the ringer switch on silent too, the way a video does once you unmute it.
  try {
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session) session.type = 'playback'
  } catch {
    // Older Safari: the ringer switch decides.
  }
  return context
}

/** How much to turn a track up or down to reach the common level, measured once per file. */
async function levelFor(url: string, ctx: AudioContext): Promise<number> {
  try {
    const saved = Number(localStorage.getItem(LEVEL_KEY + url))
    if (saved > 0) return saved
  } catch {
    // Storage blocked: just measure again.
  }
  const buffer = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
  let sum = 0
  let count = 0
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const samples = buffer.getChannelData(c)
    for (let i = 0; i < samples.length; i += 2) {
      const v = samples[i]
      sum += v * v
      count++
      if (Math.abs(v) > peak) peak = Math.abs(v)
    }
  }
  const rmsDb = 10 * Math.log10(sum / Math.max(1, count) || 1e-9)
  const level = Math.min(10 ** ((TARGET_DB - rmsDb) / 20), 1 / Math.max(peak, 0.05), 3)
  try {
    localStorage.setItem(LEVEL_KEY + url, level.toFixed(3))
  } catch {
    // Not remembered; measured again next visit.
  }
  return level
}

const refused = () => Object.assign(new Error('Sound needs a tap first'), { name: 'NotAllowedError' })

/** A looping track, played through a gain so every track sounds equally loud. */
function webAudioTrack(url: string): AudioLike {
  const el = new Audio()
  el.preload = 'none'
  el.loop = true
  el.src = url
  let volume = 1
  let level: number | null = null
  let gain: GainNode | null = null
  let wired = false

  const apply = () => {
    const out = volume * (level ?? 0)
    if (gain && context) gain.gain.setTargetAtTime(out, context.currentTime, 0.02)
    else el.volume = Math.min(1, out)
  }

  return {
    get volume() {
      return volume
    },
    set volume(v: number) {
      volume = v
      apply()
    },
    play() {
      // Runs inside the tap that turned sound on: browsers only let audio start from one.
      const ctx = audioContext()
      if (ctx && !wired) {
        wired = true
        try {
          const source = ctx.createMediaElementSource(el)
          gain = ctx.createGain()
          gain.gain.value = 0
          source.connect(gain).connect(ctx.destination)
        } catch {
          gain = null
        }
      }
      if (level === null) {
        // Silent until measured (well under a second), so a loud track never blasts out first.
        apply()
        const measuring = ctx ? levelFor(url, ctx) : Promise.resolve(0.6)
        void measuring.then(
          (l) => {
            level = l
            apply()
          },
          () => {
            level = 0.6
            apply()
          },
        )
      }
      const resumed = ctx && gain && ctx.state !== 'running' ? Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 400))]) : null
      return Promise.all([el.play(), resumed]).then(() => {
        // The page may play but keep Web Audio switched off until a tap: then it's silent, so ask for the tap.
        if (ctx && gain && ctx.state !== 'running') {
          el.pause()
          throw refused()
        }
      })
    },
    pause() {
      el.pause()
    },
  }
}

const KEY = 'eft-sound'
let shared: SoundController | null = null

/** The one controller for the page, wired to real audio, the tab's visibility and taps. */
export function soundController(): SoundController {
  if (shared) return shared
  let waiting = false
  const controller = createSoundController({
    makeAudio: webAudioTrack,
    startOn: (() => {
      try {
        return sessionStorage.getItem(KEY) === '1'
      } catch {
        return false
      }
    })(),
    save: (on) => {
      try {
        sessionStorage.setItem(KEY, on ? '1' : '0')
      } catch {
        // Private mode: it just won't be remembered after a reload.
      }
    },
    fadeMs: 350,
    onBlocked: () => {
      if (waiting) return
      waiting = true
      const events = ['click', 'touchend', 'keydown'] as const
      const retry = (e: Event) => {
        // A tap on a speaker is handled by the speaker itself.
        if (e.target instanceof Element && e.target.closest('[data-card-sound]')) return
        waiting = false
        events.forEach((name) => window.removeEventListener(name, retry, true))
        controller.tapped()
      }
      events.forEach((name) => window.addEventListener(name, retry, true))
    },
  })
  document.addEventListener('visibilitychange', () => controller.setPageVisible(document.visibilityState === 'visible'))
  shared = controller
  return controller
}
