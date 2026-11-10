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

const KEY = 'eft-sound'
let shared: SoundController | null = null

/** The one controller for the page, wired to real audio, the tab's visibility and taps. */
export function soundController(): SoundController {
  if (shared) return shared
  let waiting = false
  const controller = createSoundController({
    makeAudio: (url) => {
      const a = new Audio()
      a.preload = 'none'
      a.loop = true
      a.src = url
      return a
    },
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
