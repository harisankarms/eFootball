import { ChevronRight, Share2, X, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { League } from '../lib/queries'
import { roundLike, useCountUp } from '../lib/useCountUp'
import { Avatar } from './Avatar'
import { ShareSheet } from './Share'
import { GlowIcon, type Tint } from './ui'
import './recap.css'

export type Posters = typeof import('../lib/poster/posters')

/** One slide: its look (see recap.css), what's on it, how long it stays, and what Share makes. */
export type Slide = {
  key: string
  theme: string
  body: ReactNode
  /** How long before it moves on by itself (6 seconds unless set). */
  ms?: number
  share?: { name: string; text: string; make: (p: Posters) => Promise<Blob> }
}

const SLIDE_MS = 6000

export function Count({ value }: { value: number }) {
  const shown = useCountUp(value)
  return <>{roundLike(shown, value)}</>
}

/** Staggered entrance: the n-th thing on a slide comes in a beat after the one before. */
export const at = (i: number) => ({ '--i': i }) as CSSProperties

export function AwardSlide(props: { league: League; icon: LucideIcon; tint: Tint; label: string; ids: string[]; detail: string; title: string }) {
  const { league, icon, tint, label, ids, detail, title } = props
  return (
    <>
      <div className="recap-pop" style={at(0)}>
        <GlowIcon icon={icon} tint={tint} size="lg" />
      </div>
      <div className="recap-kicker recap-in" style={at(1)}>
        {label}
      </div>
      <div className="recap-pop flex justify-center -space-x-4" style={at(2)}>
        {ids.slice(0, 3).map((id) => (
          <Avatar key={id} league={league} id={id} size={ids.length > 1 ? 104 : 136} className="ring-4 ring-[#02040c]" />
        ))}
      </div>
      <div className="recap-title recap-in" style={at(3)}>
        {title}
      </div>
      <div className="recap-big recap-in" style={at(4)}>
        {detail}
      </div>
    </>
  )
}

/** A full-screen story like Instagram's: tap the right side for the next slide, the left for the previous, hold to pause. */
export function Story({ slides, title, onClose }: { slides: Slide[]; title: string; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)
  const [sharing, setSharing] = useState(false)
  const down = useRef<{ t: number; x: number } | null>(null)
  const slide = slides[Math.min(index, slides.length - 1)]
  const last = index >= slides.length - 1

  const next = useCallback(() => setIndex((i) => Math.min(slides.length - 1, i + 1)), [slides.length])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sharing) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose, sharing])

  // The page behind stays still while the story is open (set once, so a share sheet opening and
  // closing on top can't leave it locked).
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before
    }
  }, [])

  const paused = held || sharing

  return createPortal(
    <div className="recap" role="dialog" aria-modal="true" aria-label={title} data-paused={paused ? '' : undefined}>
      <div className="recap-frame" data-theme={slide.theme}>
        <div className="recap-top">
          <div className="recap-bars" aria-hidden>
            {slides.map((s, i) => (
              <div key={s.key} className={`recap-bar ${i < index ? 'is-done' : i === index ? 'is-now' : ''}`}>
                <span
                  key={i === index ? `now-${index}` : s.key}
                  style={{ '--recap-ms': `${s.ms ?? SLIDE_MS}ms` } as CSSProperties}
                  onAnimationEnd={i === index && !last ? next : undefined}
                />
              </div>
            ))}
          </div>
          <div className="recap-head">
            <span>
              {title.split(',')[0]} · {index + 1}/{slides.length}
            </span>
            <button type="button" className="recap-close" aria-label="Close" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="recap-glow" key={`glow-${slide.key}`} />
        <div
          key={slide.key}
          className="recap-stage"
          aria-live="polite"
          onPointerDown={(e) => {
            down.current = { t: Date.now(), x: e.clientX }
            setHeld(true)
          }}
          onPointerUp={(e) => {
            setHeld(false)
            const d = down.current
            down.current = null
            if (!d || Date.now() - d.t > 300) return
            const r = e.currentTarget.getBoundingClientRect()
            if (e.clientX - r.left < r.width / 3) prev()
            else next()
          }}
          onPointerCancel={() => {
            down.current = null
            setHeld(false)
          }}
          onPointerLeave={() => setHeld(false)}
        >
          {slide.body}
        </div>

        <div className="recap-bottom">
          {slide.share && (
            <button type="button" onClick={() => setSharing(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15">
              <Share2 className="h-4 w-4" aria-hidden /> Share
            </button>
          )}
          {last ? (
            <button type="button" onClick={onClose} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#3dff8f,#22d3ee)] px-5 text-sm font-bold text-[#03140a]">
              Done
            </button>
          ) : (
            <button type="button" onClick={next} className="inline-flex h-11 items-center gap-1 rounded-full bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {sharing && slide.share && <ShareSheet make={slide.share.make} name={slide.share.name} text={slide.share.text} onClose={() => setSharing(false)} />}
    </div>,
    document.body,
  )
}
