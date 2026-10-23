import { CircleCheck, TriangleAlert } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastItem = { id: number; kind: 'success' | 'error'; message: string }
type ToastApi = { success: (message: string) => void; error: (message: string) => void }

const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastItem['kind'], message: string) => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list.slice(-2), { id, kind, message }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl ${
              t.kind === 'success' ? 'border-accent/30 bg-surface-2 text-ink' : 'border-loss/40 bg-[#2a1216] text-[#ffd0d0]'
            }`}
          >
            {t.kind === 'success' ? (
              <CircleCheck className="mt-px h-4.5 w-4.5 shrink-0 text-accent" aria-hidden />
            ) : (
              <TriangleAlert className="mt-px h-4.5 w-4.5 shrink-0 text-[#ff9b9b]" aria-hidden />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
