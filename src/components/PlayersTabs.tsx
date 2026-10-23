import { Link, useLocation } from 'react-router'

const TABS = [
  { to: '/players', label: 'Squad' },
  { to: '/h2h', label: 'Head-to-head' },
  { to: '/hall-of-fame', label: 'Hall of Fame' },
]

export function PlayersTabs() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Players sections" className="mb-5 flex rounded-xl border border-line bg-surface p-1">
      {TABS.map((t) => {
        const active = pathname === t.to
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? 'page' : undefined}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg px-2 text-sm font-semibold whitespace-nowrap transition ${
              active ? 'bg-surface-3 text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
