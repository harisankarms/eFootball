import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useId, useSyncExternalStore, type RefObject } from 'react'
import { soundController, soundUrl, type SoundName, type SoundState } from '../lib/cardSound'

const OFF: SoundState = { on: false, playing: null, blocked: false, failed: null }
const noop = () => () => {}

export type CardSound = { on: boolean; playing: boolean; failed: boolean; toggle: () => void }

/** The card's background track, if one has been added: whether it's on and playing, and the speaker's tap. */
export function useCardSound(ref: RefObject<HTMLElement | null>, name: SoundName | null): CardSound | null {
  const url = name ? soundUrl(name) : null
  const id = useId()
  const controller = url ? soundController() : null
  const state = useSyncExternalStore(controller?.subscribe ?? noop, controller?.snapshot ?? (() => OFF))

  useEffect(() => {
    const el = ref.current
    if (!controller || !url || !el) return
    controller.add(id, url)
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => controller.seen(id, entry.intersectionRatio), { threshold: [0, 0.25, 0.5, 0.75, 1] })
    if (observer) observer.observe(el)
    else controller.seen(id, 1)
    return () => {
      observer?.disconnect()
      controller.remove(id)
    }
  }, [controller, url, id, ref])

  if (!controller || !url) return null
  return { on: state.on, playing: state.playing === url, failed: state.on && state.failed === url, toggle: () => controller.toggle(id) }
}

/** The speaker on the corner of a card, like Instagram's. */
export function SoundButton({ sound }: { sound: CardSound }) {
  const label = sound.failed ? "Sound couldn't load. Tap to turn it off" : sound.on ? 'Turn sound off' : 'Turn sound on'
  return (
    <button
      type="button"
      data-card-sound
      className={`card-sound ${sound.playing ? 'is-playing' : ''} ${sound.failed ? 'is-failed' : ''}`}
      aria-pressed={sound.on}
      aria-label={label}
      title={sound.failed ? "Sound couldn't load. Check your connection, or close and reopen the app" : sound.on ? 'Sound on' : 'Sound off'}
      onClick={sound.toggle}
    >
      {sound.on && !sound.failed ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
    </button>
  )
}
