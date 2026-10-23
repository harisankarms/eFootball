import { ArrowLeft, LoaderCircle, RefreshCw, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { friendlyError } from '../lib/api'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'light'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'btn-shine text-accent-ink bg-[linear-gradient(135deg,#3dff8f_0%,#2be8b4_55%,#22d3ee_100%)] shadow-[0_10px_30px_-12px_rgb(61_255_143/0.85)] hover:shadow-[0_12px_36px_-10px_rgb(61_255_143/0.95)] hover:brightness-105',
  secondary: 'bg-surface-2/80 text-ink border border-line-strong hover:border-accent/40 hover:bg-surface-3',
  ghost: 'text-ink-2 hover:text-ink hover:bg-white/[0.05]',
  danger: 'bg-loss/15 text-[#ff9b9b] border border-loss/40 hover:bg-loss/25',
  gold: 'btn-shine bg-[linear-gradient(135deg,#ffe08a,#ffb020)] text-[#241a00] shadow-[0_10px_30px_-12px_rgb(255_190_60/0.8)] hover:brightness-105',
  light: 'bg-white text-[#1f1f1f] hover:bg-[#ececec]',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-[15px] rounded-xl',
  lg: 'h-13 px-6 text-base rounded-2xl',
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
      className="-ml-1 flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
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
      <h2 className="mt-3 font-display text-2xl font-bold italic uppercase">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink-2">{friendlyError(error)}</p>
      {onRetry && (
        <Button className="mt-5" onClick={onRetry} icon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
      )}
    </div>
  )
}

const tints = {
  accent: 'from-accent/25 to-cyan/10 text-accent shadow-[0_0_24px_-6px_rgb(61_255_143/0.6)] ring-accent/30',
  gold: 'from-gold/30 to-gold-2/10 text-gold shadow-[0_0_24px_-6px_rgb(255_207_77/0.6)] ring-gold/30',
  violet: 'from-violet/30 to-cyan/10 text-[#c4b5fd] shadow-[0_0_24px_-6px_rgb(139_92_246/0.7)] ring-violet/35',
  cyan: 'from-cyan/25 to-violet/10 text-[#67e8f9] shadow-[0_0_24px_-6px_rgb(34_211_238/0.6)] ring-cyan/30',
  neutral: 'from-white/10 to-white/[0.02] text-ink-2 ring-white/10',
}
export type Tint = keyof typeof tints

/** A rounded icon chip with a soft coloured glow. */
export function GlowIcon({ icon: Icon, tint = 'accent', size = 'md' }: { icon: LucideIcon; tint?: Tint; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-11 w-11 rounded-xl'
  const ico = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'
  return (
    <span className={`grid shrink-0 place-items-center bg-gradient-to-br ring-1 ${box} ${tints[tint]}`}>
      <Icon className={ico} aria-hidden />
    </span>
  )
}

export function EmptyState({ icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="card overflow-hidden px-6 py-10 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(61_255_143/0.12),transparent)]" />
      <div className="relative flex justify-center">
        <GlowIcon icon={icon} size="lg" />
      </div>
      <h3 className="relative mt-4 font-display text-2xl font-bold tracking-wide italic uppercase">{title}</h3>
      {children && <div className="relative mx-auto mt-2 max-w-sm text-sm text-ink-2">{children}</div>}
    </div>
  )
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[2.6rem] leading-none font-bold tracking-wide italic uppercase">{title}</h1>
        <div aria-hidden className="mt-2.5 h-1 w-14 rounded-full bg-[linear-gradient(90deg,#3dff8f,#22d3ee,#8b5cf6)] shadow-[0_0_14px_rgb(61_255_143/0.55)]" />
        {subtitle && <p className="mt-2.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-wider text-ink italic uppercase">
        <span aria-hidden className="h-4 w-1 rounded-full bg-[linear-gradient(180deg,#3dff8f,#22d3ee)] shadow-[0_0_10px_rgb(61_255_143/0.6)]" />
        {title}
      </h2>
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
    <div role="tablist" aria-label={label} className="flex rounded-xl border border-line bg-surface/80 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition ${
            value === o.value
              ? 'bg-[linear-gradient(135deg,rgb(61_255_143/0.18),rgb(34_211_238/0.12))] text-ink shadow-[inset_0_0_0_1px_rgb(61_255_143/0.35)]'
              : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StatTile({ label, value, sub, icon, tint = 'accent' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; tint?: Tint }) {
  return (
    <div className="card overflow-hidden p-4">
      <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgb(61_255_143/0.12),transparent_70%)]" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-muted">{label}</div>
        {icon && <GlowIcon icon={icon} tint={tint} size="sm" />}
      </div>
      <div className="relative mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="relative mt-0.5 text-xs text-ink-2">{sub}</div>}
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
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? 'bg-[linear-gradient(135deg,#3dff8f,#22d3ee)] shadow-[0_0_16px_-4px_rgb(61_255_143/0.8)]' : 'bg-surface-3'
      }`}
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
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90dvh] w-full max-w-md animate-rise overflow-y-auto rounded-t-3xl border border-line-strong bg-[linear-gradient(180deg,#141e3d,#0b1229)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.8)] sm:rounded-3xl"
      >
        <div aria-hidden className="glow-line absolute inset-x-8 top-0 h-px" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-wide italic uppercase">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** The group name as a logo: first word white, the rest in the accent gradient. */
export function Wordmark({ name, className = '' }: { name: string; className?: string }) {
  const [first, ...rest] = name.trim().split(/\s+/)
  return (
    <span className={`font-display font-bold tracking-wide italic ${className}`}>
      {rest.length ? (
        <>
          <span className="text-ink">{first}</span> <span className="text-gradient">{rest.join(' ')}</span>
        </>
      ) : (
        <span className="text-gradient">{first}</span>
      )}
    </span>
  )
}

export function BallLogo({ className = '' }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16264d" />
          <stop offset="1" stopColor="#0a1124" />
        </linearGradient>
        <linearGradient id={`${id}ink`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3dff8f" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id}bg)`} />
      <circle cx="256" cy="256" r="150" fill="none" stroke={`url(#${id}ink)`} strokeWidth="30" />
      <polygon points="256,184 324.5,233.8 298.3,314.2 213.7,314.2 187.5,233.8" fill={`url(#${id}ink)`} />
      <g stroke={`url(#${id}ink)`} strokeWidth="24" strokeLinecap="round">
        <line x1="256" y1="184" x2="256" y2="124" />
        <line x1="324.5" y1="233.8" x2="381.6" y2="215.2" />
        <line x1="298.3" y1="314.2" x2="333.6" y2="362.8" />
        <line x1="213.7" y1="314.2" x2="178.4" y2="362.8" />
        <line x1="187.5" y1="233.8" x2="130.4" y2="215.2" />
      </g>
    </svg>
  )
}
