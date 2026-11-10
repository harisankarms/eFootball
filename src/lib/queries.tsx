import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { achievementStatuses, levelFor, playerTimelines, totalXp, type AchievementStatus, type LevelInfo } from './achievements'
import { api } from './backend'
import { PLAYER_COLORS } from './colors'
import { dropSaved, forgetSaved, keepSaving, restoreSaved } from './persist'
import { pastWeeks } from './stats'
import { safeTimeZone, weekKey } from './time'
import type { Achievement, LiveTable, Match, Player, Session, Settings } from './types'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: true },
  },
})

/** Demo data resets on every reload, so only the live site keeps a saved copy. */
const saving = api.mode === 'live'
/** Whose league was put back from the phone's saved copy, read once as the app starts. */
const savedOwner = saving ? restoreSaved(queryClient) : null

export const keys = {
  players: ['players'] as const,
  matches: ['matches'] as const,
  settings: ['settings'] as const,
  joinRequests: ['join-requests'] as const,
  achievements: ['achievements'] as const,
  awards: ['awards'] as const,
  announcements: ['announcements'] as const,
  comments: ['comments'] as const,
  tournaments: ['tournaments'] as const,
  me: (userId: string | null) => ['me', userId] as const,
}

export function useTournaments() {
  return useQuery({ queryKey: keys.tournaments, queryFn: () => api.getTournaments() })
}

export function useAchievements() {
  return useQuery({ queryKey: keys.achievements, queryFn: () => api.getAchievements() })
}

export function useAwards() {
  return useQuery({ queryKey: keys.awards, queryFn: () => api.getAwards() })
}

export function useAnnouncements() {
  return useQuery({ queryKey: keys.announcements, queryFn: () => api.getAnnouncements() })
}

export function useComments() {
  return useQuery({ queryKey: keys.comments, queryFn: () => api.getComments() })
}

export function usePlayers() {
  return useQuery({ queryKey: keys.players, queryFn: () => api.getPlayers() })
}

export function useMatches() {
  return useQuery({ queryKey: keys.matches, queryFn: () => api.getMatches() })
}

export function useSettings(enabled = true) {
  return useQuery({ queryKey: keys.settings, queryFn: () => api.getSettings(), enabled })
}

export function useJoinRequests(enabled: boolean) {
  return useQuery({ queryKey: keys.joinRequests, queryFn: () => api.getJoinRequests(), enabled })
}

export function useAuthOptions() {
  return useQuery({ queryKey: ['auth-options'], queryFn: () => api.getAuthOptions(), staleTime: Infinity })
}

const liveKeys: Record<LiveTable, readonly string[]> = {
  matches: keys.matches,
  match_comments: keys.comments,
  announcements: keys.announcements,
  tournaments: keys.tournaments,
}

/** Refresh everyone's screen when a friend adds a result, comment, announcement or tournament. */
export function useLiveUpdates(enabled: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    return api.subscribe((table) => void qc.invalidateQueries({ queryKey: liveKeys[table] }))
  }, [qc, enabled])
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

  const error = players.error ?? matches.error ?? settings.error
  return {
    league,
    // A failed refresh keeps showing the results already on screen (or saved on the phone).
    error: league ? null : error,
    /** The latest refresh failed, so what's shown may be out of date. */
    stale: !!league && !!error,
    refetch: () => {
      void players.refetch()
      void matches.refetch()
      void settings.refetch()
    },
  }
}

export type Progress = {
  achievements: Achievement[]
  statusesOf: (playerId: string) => AchievementStatus[]
  xpOf: (playerId: string) => number
  levelOf: (playerId: string) => LevelInfo
}

/** Achievements, XP and level for any player, worked out on demand and cached until the data changes. */
export function useProgress(league: League | null): Progress | null {
  const achievements = useAchievements()
  const awards = useAwards()
  return useMemo(() => {
    if (!league || !achievements.data || !awards.data) return null
    const list = achievements.data
    const awarded = awards.data
    const weeks = pastWeeks(league.matches, league.settings, weekKey(new Date(), league.tz), league.nameOf)
    const cache = new Map<string, AchievementStatus[]>()
    const statusesOf = (id: string) => {
      let s = cache.get(id)
      if (!s) {
        s = achievementStatuses(list, awarded, playerTimelines(league.matches, id, weeks, league.tz), id)
        cache.set(id, s)
      }
      return s
    }
    const xpOf = (id: string) => totalXp(statusesOf(id))
    return { achievements: list, statusesOf, xpOf, levelOf: (id: string) => levelFor(xpOf(id)) }
  }, [league, achievements.data, awards.data])
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
  // With a saved league, start as its owner straight away; the sign-in check below catches up.
  const [ready, setReady] = useState(!!savedOwner)
  const [session, setSession] = useState<Session | null>(savedOwner)

  useEffect(() => {
    let alive = true
    let owner = savedOwner?.userId ?? null
    const apply = (s: Session | null) => {
      if (!alive) return
      // Someone else signed in on this phone: drop the previous person's saved league.
      if (s && owner && s.userId !== owner) forgetSaved(qc)
      owner = s?.userId ?? owner
      setSession((prev) => (prev?.userId === s?.userId ? prev : s))
      setReady(true)
    }
    api
      .getSession()
      .then((s) => {
        if (!s && owner) {
          forgetSaved(qc)
          owner = null
        }
        apply(s)
      })
      // Offline or the sign-in server is unreachable: keep showing the saved league, if there is one.
      .catch(() => alive && setReady(true))
    const off = api.onAuthChange((s, signedOut) => {
      if (signedOut) {
        forgetSaved(qc)
        owner = null
      }
      apply(s)
    })
    return () => {
      alive = false
      off()
    }
  }, [qc])

  const meQuery = useQuery({
    queryKey: keys.me(session?.userId ?? null),
    enabled: !!session,
    // Checked again now and then, so a saved "member" who has since been deactivated finds out.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const known = session ? qc.getQueryData(keys.me(session.userId)) !== undefined : false
      const p = await api.linkMe()
      // The first sign-in may have just created a player.
      if (!known) void qc.invalidateQueries({ queryKey: keys.players })
      return p
    },
  })

  const { data: meData, isPending: mePending, error: meError, refetch } = meQuery
  const member = !!meData?.active

  // Members keep a saved copy of the league; anyone else (waiting, deactivated) doesn't.
  useEffect(() => {
    if (!saving || !session) return
    if (!member) {
      if (meData !== undefined) dropSaved()
      return
    }
    const userId = session.userId
    return keepSaving(qc, session, () => !!qc.getQueryData<Player | null>(keys.me(userId))?.active)
  }, [qc, session, member, meData])
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
