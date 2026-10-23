import { Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { WaitingForApproval } from '../components/Guards'
import { BallLogo, Button, PageSkeleton } from '../components/ui'
import { friendlyError } from '../lib/api'
import { api, isDemo } from '../lib/backend'
import { useAuth, useAuthOptions, useSettings } from '../lib/queries'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default function Login() {
  const { ready, session, isMember, meLoading } = useAuth()
  const { data: settings } = useSettings()
  const { data: authOptions } = useAuthOptions()
  const googleEnabled = !!authOptions?.google
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'google' | 'email' | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (session && isMember) navigate(from, { replace: true })
  }, [session, isMember, from, navigate])

  if (!ready || (session && meLoading)) return <PageSkeleton />
  if (session && !isMember) return <WaitingForApproval />

  async function google() {
    setBusy('google')
    setMessage(null)
    try {
      await api.signInWithGoogle()
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e) })
      setBusy(null)
    }
  }

  async function submit() {
    setBusy('email')
    setMessage(null)
    try {
      if (mode === 'signin') {
        await api.signInWithPassword(email.trim(), password)
      } else {
        const { needsConfirmation } = await api.signUpWithPassword(email.trim(), password, name.trim())
        if (needsConfirmation) {
          setMessage({ kind: 'info', text: 'Check your inbox and click the confirmation link, then sign in here.' })
          setMode('signin')
        }
      }
    } catch (e) {
      setMessage({ kind: 'error', text: friendlyError(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-4">
      <div className="text-center">
        <BallLogo className="mx-auto h-16 w-16" />
        <h1 className="mt-4 font-display text-4xl leading-none font-bold uppercase">{settings?.group_name ?? 'Squad League'}</h1>
        <p className="mt-2 text-sm text-ink-2">Sign in to log results. Anyone with the link can view the table.</p>
      </div>

      <div className="card mt-7 p-5">
        {googleEnabled && (
          <>
            <Button variant="light" className="w-full" size="lg" loading={busy === 'google'} icon={<GoogleIcon />} onClick={google}>
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              or with email
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {mode === 'signup' && (
            <input className="field" placeholder="Your name" autoComplete="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="field" type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            className="field"
            type="password"
            placeholder={mode === 'signup' ? 'Choose a password (6+ characters)' : 'Password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {message && (
            <p
              role="alert"
              className={`rounded-xl px-3.5 py-2.5 text-sm ${
                message.kind === 'error' ? 'border border-loss/40 bg-[#2a1216] text-[#ffd0d0]' : 'border border-accent/30 bg-accent/10 text-ink'
              }`}
            >
              {message.text}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === 'email'}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setMessage(null)
          }}
          className="mt-4 w-full text-center text-sm text-ink-2 hover:text-ink"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>

      {(isDemo || googleEnabled) && (
        <p className="mt-5 flex gap-2 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {isDemo
            ? 'Demo mode: any option signs you in as Hari, the admin.'
            : 'Opened this from WhatsApp or Instagram? Google blocks sign-in inside those apps. Open the link in Chrome or Safari, or use email.'}
        </p>
      )}
      <p className="mt-3 text-center text-xs">
        <Link to="/" className="text-ink-2 hover:text-ink">
          Just looking? Back to the table
        </Link>
      </p>
    </div>
  )
}
