import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Lightbox({ src, alt = 'Screenshot', onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 grid animate-[rise_0.2s_ease-out] place-items-center bg-black/95 p-3" onClick={onClose} role="dialog" aria-label={alt}>
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
      <button
        onClick={onClose}
        aria-label="Close"
        className="pt-safe absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  )
}
