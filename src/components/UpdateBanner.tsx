import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

/** Look for a new version at most this often while the app is open. */
const CHECK_EVERY = 15 * 60_000

/**
 * After a deploy, the new version installs in the background and takes over on the next open.
 * This offers it right away instead, and checks for one when the app comes back to the front
 * (an installed app can stay open in the background for days).
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false)
  const { pathname } = useLocation()
  // Not while a result is being typed in: the banner would sit on the Save button, and a refresh would lose the form.
  const onForm = pathname === '/add' || pathname.endsWith('/edit')

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    // The very first install also takes control; that isn't an update.
    const hadController = !!sw.controller
    const onTakeover = () => {
      if (hadController) setReady(true)
    }
    sw.addEventListener('controllerchange', onTakeover)

    let lastCheck = Date.now()
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_EVERY) return
      lastCheck = Date.now()
      void sw
        .getRegistration()
        .then((r) => r?.update())
        .catch(() => undefined)
    }
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, CHECK_EVERY)
    return () => {
      sw.removeEventListener('controllerchange', onTakeover)
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }, [])

  if (!ready || onForm) return null
  return (
    <div
      role="status"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-[5.5rem] z-40 flex animate-rise items-center gap-3 rounded-2xl border border-accent/30 bg-surface-2 py-2 pr-2 pl-4 text-sm shadow-2xl lg:right-6 lg:bottom-6 lg:left-auto lg:w-80"
    >
      <span className="min-w-0 flex-1 font-medium">New version ready</span>
      <button
        onClick={() => window.location.reload()}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-ink"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Refresh
      </button>
    </div>
  )
}
