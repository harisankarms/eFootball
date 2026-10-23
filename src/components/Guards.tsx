import { Copy, Hourglass, Lock, LogIn } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { api } from '../lib/backend'
import { useAuth } from '../lib/queries'
import { useToast } from './Toast'
import { Button, ErrorState, buttonClass } from './ui'

export function SignInPrompt({ reason }: { reason: string }) {
  const location = useLocation()
  return (
    <div className="card mx-auto max-w-md p-7 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/12 text-accent">
        <Lock className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold uppercase italic">Sign in first</h2>
      <p className="mt-2 text-sm text-ink-2">You need to sign in {reason}.</p>
      <Link to="/login" state={{ from: location.pathname }} className={buttonClass('primary', 'lg', 'mt-6 w-full')}>
        <LogIn className="h-5 w-5" aria-hidden />
        Sign in
      </Link>
    </div>
  )
}

export function WaitingForApproval() {
  const { session, me, meError, refetchMe } = useAuth()
  const toast = useToast()
  if (meError) return <ErrorState error={meError} onRetry={refetchMe} />
  const deactivated = !!me && !me.active
  return (
    <div className="card mx-auto max-w-md p-7 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warn/15 text-warn">
        <Hourglass className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold uppercase italic">
        {deactivated ? 'Your player is inactive' : 'Waiting for approval'}
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        {deactivated
          ? 'An admin has deactivated your player. Ask them to reactivate you.'
          : "You're signed in, but not in the squad yet. Ask the admin to approve you on the Admin page. You'll be in as soon as they do."}
      </p>
      {session?.email && (
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(session.email ?? '')
            toast.success('Email copied')
          }}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3.5 py-2 text-sm text-ink-2 hover:text-ink"
        >
          {session.email}
          <Copy className="h-4 w-4" aria-hidden />
        </button>
      )}
      <Button variant="ghost" className="mt-4" onClick={() => void api.signOut()}>
        Sign out
      </Button>
    </div>
  )
}
