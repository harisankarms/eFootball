import { useQueryClient } from '@tanstack/react-query'
import { House, Info, ListOrdered, LogIn, LogOut, Pencil, Plus, Settings, Swords, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { friendlyError } from '../lib/api'
import { api, isDemo } from '../lib/backend'
import { keys, useAuth, useLeague, useLiveUpdates, useSettings } from '../lib/queries'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { BallLogo, Button, Sheet, buttonClass } from './ui'

type NavItem = { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: House, match: (p) => p === '/' },
  { to: '/matches', label: 'Matches', icon: Swords, match: (p) => p.startsWith('/match') },
  { to: '/table', label: 'Table', icon: ListOrdered, match: (p) => p.startsWith('/table') },
  {
    to: '/players',
    label: 'Players',
    icon: Users,
    match: (p) => p.startsWith('/players') || p.startsWith('/h2h') || p.startsWith('/hall-of-fame'),
  },
]

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-accent/[0.07] blur-3xl" />
      <div className="absolute top-1/3 -right-48 h-[30rem] w-[30rem] rounded-full bg-[#38bdf8]/[0.06] blur-3xl" />
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

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink-2 hover:bg-surface-3 hover:text-ink'
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-line-strong transition hover:ring-accent"
      >
        {me && league ? <Avatar league={league} id={me.id} size={34} /> : <UserRound className="h-5 w-5 text-ink-2" />}
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-50 w-60 animate-rise rounded-2xl border border-line bg-surface-2 p-1.5 shadow-2xl">
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
  const { isMember } = useAuth()
  const { pathname } = useLocation()
  useEffect(() => {
    if (settings?.group_name) document.title = settings.group_name
  }, [settings?.group_name])
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-line/70 bg-bg/95">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <BallLogo className="h-8 w-8 shrink-0" />
          <span className="truncate font-display text-[1.4rem] font-bold tracking-wide uppercase">
            {settings?.group_name ?? 'Squad League'}
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                n.match(pathname) ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isMember && (
            <div className="hidden md:block">
              <Link to="/add" className={buttonClass('primary', 'sm')}>
                <Plus className="h-4 w-4" aria-hidden strokeWidth={2.75} />
                Add result
              </Link>
            </div>
          )}
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}

function BottomNav() {
  const { pathname } = useLocation()
  const tab = (n: NavItem) => {
    const active = n.match(pathname)
    return (
      <Link
        key={n.to}
        to={n.to}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition ${active ? 'text-accent' : 'text-muted'}`}
      >
        <n.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
        {n.label}
      </Link>
    )
  }
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/[0.97] md:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {tab(NAV[0])}
        {tab(NAV[1])}
        <Link
          to="/add"
          aria-label="Add result"
          className="mx-auto -mt-8 grid h-15 w-15 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_10px_30px_-6px_rgb(61_255_143/0.65)] ring-[5px] ring-bg transition active:scale-95"
        >
          <Plus className="h-7 w-7" strokeWidth={2.75} aria-hidden />
        </Link>
        {tab(NAV[2])}
        {tab(NAV[3])}
      </div>
    </nav>
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
      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-8 md:pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
