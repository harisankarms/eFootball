import { Link, useLocation } from 'react-router'

const TABS = [
  { to: '/players', label: 'Squad' },
  { to: '/hall-of-fame', label: 'Hall of Fame' },
]

export function PlayersTabs() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Players sections" className="mb-5 flex rounded-xl border border-line bg-surface/80 p-1">
      {TABS.map((t) => {
        const active = pathname === t.to
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? 'page' : undefined}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg px-2 text-sm font-semibold whitespace-nowrap transition ${
              active
                ? 'bg-[linear-gradient(135deg,rgb(61_255_143/0.18),rgb(34_211_238/0.12))] text-ink shadow-[inset_0_0_0_1px_rgb(61_255_143/0.35)]'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
