import { useQueryClient } from '@tanstack/react-query'
import { Gamepad2, House, Info, ListOrdered, LogIn, LogOut, Pencil, Plus, Settings, Swords, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { friendlyError } from '../lib/api'
import { api, isDemo } from '../lib/backend'
import { keys, useAuth, useLeague, useLiveUpdates, useSettings } from '../lib/queries'
import { DEFAULT_SETTINGS } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { BallLogo, Button, Sheet, Wordmark, buttonClass } from './ui'

type NavItem = { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: House, match: (p) => p === '/' },
  { to: '/matches', label: 'Matches', icon: Gamepad2, match: (p) => p.startsWith('/match') },
  { to: '/table', label: 'Table', icon: ListOrdered, match: (p) => p.startsWith('/table') },
  { to: '/h2h', label: 'H2H', icon: Swords, match: (p) => p.startsWith('/h2h') },
  { to: '/players', label: 'Players', icon: Users, match: (p) => p.startsWith('/players') || p.startsWith('/hall-of-fame') },
]

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0e1a40_0%,#050816_62%)]" />
      <div className="bg-grid absolute inset-0" />
      <div className="aurora aurora-green" />
      <div className="aurora aurora-violet" />
      <div className="aurora aurora-cyan" />
    </div>
  )
}

function EditNameSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(current)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) setName(current)
  }, [open, current])

  async function save() {
    setSaving(true)
    try {
      await api.updateMyName(name)
      await Promise.all([qc.invalidateQueries({ queryKey: ['me'] }), qc.invalidateQueries({ queryKey: keys.players })])
      toast.success('Name updated')
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your name">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">Shown on the table and match cards</span>
          <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={saving} disabled={!name.trim()}>
          Save
        </Button>
      </form>
    </Sheet>
  )
}

function AccountMenu() {
  const { ready, session, me, isAdmin } = useAuth()
  const { league } = useLeague()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!ready) return <div className="h-9 w-9" />
  if (!session) {
    return (
      <Link to="/login" className={buttonClass('secondary', 'sm')}>
        <LogIn className="h-4 w-4" aria-hidden />
        Sign in
      </Link>
    )
  }

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink-2 transition hover:bg-white/[0.06] hover:text-ink'
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="grid place-items-center rounded-full transition hover:scale-105"
      >
        {me && league ? <Avatar league={league} id={me.id} size={34} ring="gradient" /> : <UserRound className="h-6 w-6 text-ink-2" />}
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-50 w-60 animate-rise rounded-2xl border border-line-strong bg-[linear-gradient(180deg,#151f40,#0d1530)] p-1.5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
          <div className="border-b border-line px-3 pt-2 pb-2.5">
            <div className="truncate text-sm font-semibold">{me?.name ?? 'Waiting for approval'}</div>
            <div className="truncate text-xs text-muted">{session.email}</div>
          </div>
          <div className="pt-1.5">
            {me && (
              <>
                <Link to={`/players/${me.id}`} onClick={() => setOpen(false)} className={item}>
                  <UserRound className="h-4 w-4" aria-hidden /> My profile
                </Link>
                <button
                  onClick={() => {
                    setOpen(false)
                    setEditing(true)
                  }}
                  className={item}
                >
                  <Pencil className="h-4 w-4" aria-hidden /> Change my name
                </button>
              </>
            )}
            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className={item}>
                <Settings className="h-4 w-4" aria-hidden /> Admin
              </Link>
            )}
            <button
              onClick={async () => {
                setOpen(false)
                try {
                  await api.signOut()
                  navigate('/')
                } catch (e) {
                  toast.error(friendlyError(e))
                }
              }}
              className={item}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}
      {me && <EditNameSheet open={editing} onClose={() => setEditing(false)} current={me.name} />}
    </div>
  )
}

function Header() {
  const { data: settings } = useSettings()
  const { pathname } = useLocation()
  const name = settings?.group_name ?? DEFAULT_SETTINGS.group_name
  useEffect(() => {
    document.title = name
  }, [name])
  return (
    <header className="pt-safe sticky top-0 z-40 bg-bg/90">
      <div className="mx-auto flex h-15 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="group flex min-w-0 items-center gap-2.5">
          <BallLogo className="h-9 w-9 shrink-0 drop-shadow-[0_0_12px_rgb(61_255_143/0.45)] transition duration-500 group-hover:rotate-[72deg]" />
          <Wordmark name={name} className="truncate text-[1.6rem] leading-none" />
        </Link>
        <nav className="ml-5 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = n.match(pathname)
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-white/[0.06] text-ink' : 'text-muted hover:bg-white/[0.04] hover:text-ink'
                }`}
              >
                {n.label === 'H2H' ? 'Head to Head' : n.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-[linear-gradient(90deg,#3dff8f,#22d3ee)] shadow-[0_0_10px_rgb(61_255_143/0.8)]"
                  />
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <div className="hidden md:block">
            <Link to="/add" className={buttonClass('primary', 'sm')}>
              <Plus className="h-4 w-4" aria-hidden strokeWidth={2.75} />
              Add result
            </Link>
          </div>
          <AccountMenu />
        </div>
      </div>
      <div aria-hidden className="glow-line h-px opacity-70" />
    </header>
  )
}

function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 bg-[#060b1d]/95 md:hidden">
      <div aria-hidden className="glow-line h-px opacity-60" />
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        {NAV.map((n) => {
          const active = n.match(pathname)
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition ${active ? 'text-accent' : 'text-muted'}`}
            >
              <span
                className={`grid h-7 w-12 place-items-center rounded-full transition ${
                  active ? 'bg-accent/15 shadow-[0_0_18px_-4px_rgb(61_255_143/0.7)]' : ''
                }`}
              >
                <n.icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
              </span>
              {n.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function AddButton() {
  const { pathname } = useLocation()
  if (pathname === '/add' || pathname.endsWith('/edit') || pathname === '/login') return null
  return (
    <Link
      to="/add"
      aria-label="Add result"
      className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#3dff8f,#22d3ee)] text-accent-ink shadow-[0_14px_34px_-8px_rgb(61_255_143/0.8)] transition active:scale-95 md:hidden"
    >
      <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-2xl bg-accent/50" />
      <Plus className="relative h-7 w-7" strokeWidth={2.75} />
    </Link>
  )
}

function DemoBanner() {
  return (
    <div className="border-b border-warn/20 bg-warn/[0.08] px-4 py-2 text-center text-xs text-warn">
      <Info className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
      Demo mode: sample data, changes vanish on reload. Connect Supabase (see README) to go live.
    </div>
  )
}

/** Shows sign-in errors that Supabase passes back in the URL after a failed Google login. */
function useAuthErrorFromUrl() {
  const toast = useToast()
  useEffect(() => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const message = url.searchParams.get('error_description') ?? hash.get('error_description')
    if (!message) return
    toast.error(`Sign-in failed: ${message.replace(/\+/g, ' ')}`)
    window.history.replaceState(null, '', url.pathname)
  }, [toast])
}

export function Layout() {
  const { pathname } = useLocation()
  useLiveUpdates()
  useAuthErrorFromUrl()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <Backdrop />
      <Header />
      {isDemo && <DemoBanner />}
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] md:pt-9 md:pb-16">
        <div key={pathname} className="animate-page">
          <Outlet />
        </div>
      </main>
      <AddButton />
      <BottomNav />
    </div>
  )
}
