import { Download, LoaderCircle, Share2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { friendlyError } from '../lib/api'
import { Button, Sheet, buttonClass } from './ui'

type Posters = typeof import('../lib/poster/posters')

type Props = {
  /** Draws the picture (the drawing code downloads the first time someone shares). */
  make: (posters: Posters) => Promise<Blob>
  /** File name without the extension. */
  name: string
  /** Text that goes with the picture when shared, e.g. into WhatsApp. */
  text?: string
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'efootball'

/** A Share button that turns something into a picture, shows it, and shares or saves it. */
export function ShareButton({ make, name, text, label = 'Share', size = 'sm', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass('secondary', size, className)}>
        <Share2 className="h-4 w-4" aria-hidden />
        {label}
      </button>
      {open && <ShareSheet make={make} name={name} text={text} onClose={() => setOpen(false)} />}
    </>
  )
}

/** The sheet itself, for places that open it some other way (e.g. a story's share button). */
export function ShareSheet({ make, name, text, onClose }: { make: Props['make']; name: string; text?: string; onClose: () => void }) {
  const [state, setState] = useState<{ blob: Blob; url: string } | { error: unknown } | null>(null)

  useEffect(() => {
    let alive = true
    let url = ''
    import('../lib/poster/posters')
      .then((posters) => make(posters))
      .then((blob) => {
        url = URL.createObjectURL(blob)
        if (alive) setState({ blob, url })
        else URL.revokeObjectURL(url)
      })
      .catch((error: unknown) => alive && setState({ error }))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // Made once, when the sheet opens.
  }, [])

  const file = state && 'blob' in state ? new File([state.blob], `${slug(name)}.png`, { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], text })
    } catch {
      // Closed the share sheet.
    }
  }

  return (
    <Sheet open onClose={onClose} title="Share">
      {!state ? (
        <div className="grid aspect-[4/5] place-items-center rounded-2xl border border-line bg-surface/60 text-muted" role="status">
          <span className="flex items-center gap-2 text-sm">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> Making the picture…
          </span>
        </div>
      ) : 'error' in state ? (
        <div className="rounded-2xl border border-line bg-surface/60 p-6 text-center">
          <TriangleAlert className="mx-auto h-7 w-7 text-warn" aria-hidden />
          <p className="mt-2 text-sm text-ink-2">Couldn't make the picture. {friendlyError(state.error)}</p>
        </div>
      ) : (
        <>
          <img src={state.url} alt="The picture to share" className="w-full rounded-2xl border border-line shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)]" />
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {canShare && (
              <Button variant="primary" size="lg" icon={<Share2 className="h-5 w-5" />} onClick={() => void share()}>
                Share
              </Button>
            )}
            <a href={state.url} download={`${slug(name)}.png`} className={buttonClass(canShare ? 'secondary' : 'primary', 'lg', canShare ? '' : 'sm:col-span-2')}>
              <Download className="h-5 w-5" aria-hidden />
              Save picture
            </a>
          </div>
        </>
      )}
    </Sheet>
  )
}
