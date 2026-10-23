import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './backend'
import { PLAYER_COLORS } from './colors'
import { safeTimeZone } from './time'
import type { Match, Player, Session, Settings } from './types'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: true },
  },
})

export const keys = {
  players: ['players'] as const,
  matches: ['matches'] as const,
  settings: ['settings'] as const,
  joinRequests: ['join-requests'] as const,
  me: (userId: string | null) => ['me', userId] as const,
}

export function usePlayers() {
  return useQuery({ queryKey: keys.players, queryFn: () => api.getPlayers() })
}

export function useMatches() {
  return useQuery({ queryKey: keys.matches, queryFn: () => api.getMatches() })
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api.getSettings() })
}

export function useJoinRequests(enabled: boolean) {
  return useQuery({ queryKey: keys.joinRequests, queryFn: () => api.getJoinRequests(), enabled })
}

export function useAuthOptions() {
  return useQuery({ queryKey: ['auth-options'], queryFn: () => api.getAuthOptions(), staleTime: Infinity })
}

/** Refresh everyone's screen when a friend adds, edits or deletes a result. */
export function useLiveUpdates() {
  const qc = useQueryClient()
  useEffect(() => api.subscribe(() => void qc.invalidateQueries({ queryKey: keys.matches })), [qc])
}

export type League = {
  players: Player[]
  matches: Match[]
  settings: Settings
  tz: string
  byId: Map<string, Player>
  nameOf: (id: string) => string
  colorOf: (id: string) => string
}

/** Players, matches and settings together, plus lookups every screen needs. */
export function useLeague() {
  const players = usePlayers()
  const matches = useMatches()
  const settings = useSettings()

  const league = useMemo<League | null>(() => {
    if (!players.data || !matches.data || !settings.data) return null
    const tz = safeTimeZone(settings.data.timezone)
    const byId = new Map(players.data.map((p) => [p.id, p]))
    const order = new Map(players.data.map((p, i) => [p.id, i]))
    return {
      players: players.data,
      matches: matches.data,
      settings: { ...settings.data, timezone: tz },
      tz,
      byId,
      nameOf: (id) => byId.get(id)?.name ?? 'Unknown',
      colorOf: (id) => PLAYER_COLORS[(order.get(id) ?? 0) % PLAYER_COLORS.length],
    }
  }, [players.data, matches.data, settings.data])

  return {
    league,
    error: players.error ?? matches.error ?? settings.error,
    refetch: () => {
      void players.refetch()
      void matches.refetch()
      void settings.refetch()
    },
  }
}

/** Re-renders every `ms` so countdowns and "5m ago" labels stay fresh. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

type AuthState = {
  /** False until we know whether someone is signed in. */
  ready: boolean
  session: Session | null
  me: Player | null
  meLoading: boolean
  /** Looking up the signed-in player failed (for example a network error). */
  meError: unknown
  refetchMe: () => void
  isMember: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthState>({
  ready: false,
  session: null,
  me: null,
  meLoading: false,
  meError: null,
  refetchMe: () => {},
  isMember: false,
  isAdmin: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let alive = true
    const apply = (s: Session | null) => {
      if (!alive) return
      setSession((prev) => (prev?.userId === s?.userId ? prev : s))
      setReady(true)
    }
    api
      .getSession()
      .then(apply)
      .catch(() => apply(null))
    const off = api.onAuthChange(apply)
    return () => {
      alive = false
      off()
    }
  }, [])

  const meQuery = useQuery({
    queryKey: keys.me(session?.userId ?? null),
    enabled: !!session,
    staleTime: Infinity,
    queryFn: async () => {
      const p = await api.linkMe()
      // The first sign-in may have just created a player.
      void qc.invalidateQueries({ queryKey: keys.players })
      return p
    },
  })

  const { data: meData, isPending: mePending, error: meError, refetch } = meQuery
  const value = useMemo<AuthState>(() => {
    const me = session ? (meData ?? null) : null
    return {
      ready,
      session,
      me,
      meLoading: !!session && mePending && !meError,
      meError: session ? meError : null,
      refetchMe: () => void refetch(),
      isMember: !!me?.active,
      isAdmin: !!me?.active && me.is_admin,
    }
  }, [ready, session, meData, mePending, meError, refetch])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
