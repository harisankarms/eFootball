import { ArrowLeft, LoaderCircle, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { friendlyError } from '../lib/api'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'light'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-2 shadow-[0_6px_24px_-8px_rgb(61_255_143/0.7)]',
  secondary: 'bg-surface-2 text-ink border border-line-strong hover:bg-surface-3',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-loss/15 text-[#ff9b9b] border border-loss/40 hover:bg-loss/25',
  gold: 'bg-gold text-[#241a00] hover:bg-gold-2',
  light: 'bg-white text-[#1f1f1f] hover:bg-[#ececec]',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-[15px] rounded-xl',
  lg: 'h-13 px-5 text-base rounded-2xl',
}

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${extra}`
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant, size, loading, icon, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

/** Goes back in history, or to `fallback` when the page was opened directly from a shared link. */
export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <button
      onClick={() => (location.key === 'default' ? navigate(fallback) : navigate(-1))}
      className="-ml-1 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </button>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-muted" role="status">
      <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-2/70 ${className}`} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-52" />
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <TriangleAlert className="mx-auto h-8 w-8 text-warn" aria-hidden />
      <h2 className="mt-3 font-display text-2xl font-bold uppercase">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink-2">{friendlyError(error)}</p>
      {onRetry && (
        <Button className="mt-5" onClick={onRetry} icon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-ink-2">{icon}</div>
      <h3 className="mt-4 font-display text-xl font-bold uppercase tracking-wide">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-sm text-sm text-ink-2">{children}</div>}
    </div>
  )
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-none font-bold tracking-wide uppercase">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-bold tracking-wider text-ink-2 uppercase">{title}</h2>
      {action}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn' | 'gold' | 'accent' | 'danger'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-2',
    warn: 'bg-warn/15 text-warn',
    gold: 'bg-gold/15 text-gold',
    accent: 'bg-accent/12 text-accent',
    danger: 'bg-loss/15 text-[#ff9b9b]',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition ${
            value === o.value ? 'bg-surface-3 text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90dvh] w-full max-w-md animate-rise overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-wide uppercase">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function BallLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#0d1628" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#3dff8f" strokeWidth="30" />
      <polygon points="256,184 324.5,233.8 298.3,314.2 213.7,314.2 187.5,233.8" fill="#3dff8f" />
      <g stroke="#3dff8f" strokeWidth="24" strokeLinecap="round">
        <line x1="256" y1="184" x2="256" y2="124" />
        <line x1="324.5" y1="233.8" x2="381.6" y2="215.2" />
        <line x1="298.3" y1="314.2" x2="333.6" y2="362.8" />
        <line x1="213.7" y1="314.2" x2="178.4" y2="362.8" />
        <line x1="187.5" y1="233.8" x2="130.4" y2="215.2" />
      </g>
    </svg>
  )
}
