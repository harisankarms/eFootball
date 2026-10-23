import type { Api } from './api'
import { DEMO_EMAIL, DEMO_USER_ID, makeDemoData } from './demo-data'
import type { Match, MatchInput, Player, Session, Shot } from './types'

/** In-memory backend with sample data. Changes last until the page is reloaded. */
export function createDemoApi(): Api {
  const db = makeDemoData()
  let session: Session | null = { userId: DEMO_USER_ID, email: DEMO_EMAIL }
  const authListeners = new Set<(s: Session | null) => void>()
  const changeListeners = new Set<() => void>()

  const pause = (ms = 120) => new Promise((r) => setTimeout(r, ms))
  const copy = <T>(v: T): T => structuredClone(v)
  const deny = () => new Error("You don't have permission to do that.")
  const me = () => db.players.find((p) => p.user_id === session?.userId && p.active) ?? null
  const requireMe = () => {
    const m = me()
    if (!m) throw deny()
    return m
  }
  const requireAdmin = () => {
    const m = requireMe()
    if (!m.is_admin) throw deny()
    return m
  }
  const findMatch = (id: string) => {
    const m = db.matches.find((x) => x.id === id)
    if (!m) throw new Error('Match not found.')
    return m
  }
  const withinWindow = (m: Match) => Date.now() - Date.parse(m.created_at) < db.settings.dispute_hours * 3600_000
  const changed = () => changeListeners.forEach((f) => f())
  const setSession = (s: Session | null) => {
    session = s
    authListeners.forEach((f) => f(s))
  }
  const signIn = async () => {
    await pause(300)
    setSession({ userId: DEMO_USER_ID, email: DEMO_EMAIL })
  }
  const shotPaths = (shot: Shot | null) =>
    shot
      ? { screenshot_path: URL.createObjectURL(shot.full), thumb_path: URL.createObjectURL(shot.thumb) }
      : { screenshot_path: null, thumb_path: null }
  const validate = (input: MatchInput) => {
    if (input.home_id === input.away_id) throw new Error('different_players')
    if (input.pens_winner_id && (input.home_goals !== input.away_goals || ![input.home_id, input.away_id].includes(input.pens_winner_id)))
      throw new Error('pens_only_after_a_draw')
  }

  return {
    mode: 'demo',

    async getAuthOptions() {
      return { google: true }
    },
    async getSession() {
      return session
    },
    onAuthChange(cb) {
      authListeners.add(cb)
      return () => authListeners.delete(cb)
    },
    signInWithGoogle: signIn,
    signInWithPassword: signIn,
    async signUpWithPassword() {
      await signIn()
      return { needsConfirmation: false }
    },
    async signOut() {
      setSession(null)
    },
    async linkMe() {
      await pause(60)
      const p = db.players.find((x) => x.user_id === session?.userId)
      return p ? copy(p) : null
    },

    async getPlayers() {
      await pause()
      return copy(db.players)
    },
    async getMatches() {
      await pause()
      return copy(db.matches)
    },
    async getSettings() {
      await pause(60)
      return copy(db.settings)
    },
    subscribe(onChange) {
      changeListeners.add(onChange)
      return () => changeListeners.delete(onChange)
    },

    async addMatch(input, shot, submittedBy) {
      await pause(500)
      requireMe()
      validate(input)
      const now = new Date().toISOString()
      const match: Match = {
        id: crypto.randomUUID(),
        ...input,
        ...shotPaths(shot),
        submitted_by: submittedBy,
        status: 'ok',
        dispute_reason: null,
        disputed_by: null,
        created_at: now,
      }
      db.matches.push(match)
      changed()
      return copy(match)
    },
    async updateMatch(match, input, shot) {
      await pause(400)
      requireAdmin()
      validate(input)
      const m = findMatch(match.id)
      Object.assign(m, input, shot ? shotPaths(shot) : {})
      changed()
    },
    async deleteMatch(match) {
      await pause(300)
      const m = findMatch(match.id)
      const p = requireMe()
      if (!p.is_admin && !(m.submitted_by === p.id && withinWindow(m)))
        throw new Error('You can only delete your own results within the dispute window.')
      db.matches = db.matches.filter((x) => x.id !== m.id)
      changed()
    },
    async disputeMatch(matchId, reason) {
      await pause(300)
      const m = findMatch(matchId)
      const p = requireMe()
      if (![m.home_id, m.away_id].includes(p.id) || m.submitted_by === p.id)
        throw new Error('Only the other player in this match can dispute it')
      if (!withinWindow(m)) throw new Error(`The ${db.settings.dispute_hours} hour dispute window has closed`)
      Object.assign(m, { status: 'disputed', dispute_reason: reason.trim().slice(0, 200) || null, disputed_by: p.id })
      changed()
    },
    async resolveDispute(matchId) {
      await pause(300)
      requireAdmin()
      Object.assign(findMatch(matchId), { status: 'ok', dispute_reason: null, disputed_by: null })
      changed()
    },
    async updateMyName(name) {
      await pause(300)
      const trimmed = name.trim()
      if (trimmed.length < 1 || trimmed.length > 40) throw new Error('Name must be between 1 and 40 characters')
      requireMe().name = trimmed
    },

    async getJoinRequests() {
      await pause()
      requireAdmin()
      return copy(db.joinRequests)
    },
    async approveJoin(userId, playerId) {
      await pause(300)
      requireAdmin()
      const r = db.joinRequests.find((x) => x.user_id === userId)
      if (!r) throw new Error('That join request no longer exists')
      if (playerId) {
        const p = db.players.find((x) => x.id === playerId && !x.user_id)
        if (!p) throw new Error('That player is already linked to another account')
        p.user_id = userId
      } else {
        db.players.push(newPlayer(r.name ?? 'Player', userId))
      }
      db.joinRequests = db.joinRequests.filter((x) => x.user_id !== userId)
    },
    async rejectJoin(userId) {
      await pause(200)
      requireAdmin()
      db.joinRequests = db.joinRequests.filter((x) => x.user_id !== userId)
    },
    async addPlayer(name) {
      await pause(300)
      requireAdmin()
      db.players.push(newPlayer(name.trim(), null))
    },
    async updatePlayer(id, patch) {
      await pause(300)
      requireAdmin()
      const p = db.players.find((x) => x.id === id)
      if (!p) throw new Error('Player not found.')
      Object.assign(p, patch)
    },
    async updateSettings(patch) {
      await pause(300)
      requireAdmin()
      Object.assign(db.settings, patch)
    },

    imageUrl(path) {
      return path
    },
  }
}

function newPlayer(name: string, userId: string | null): Player {
  return {
    id: crypto.randomUUID(),
    name,
    user_id: userId,
    avatar_url: null,
    is_admin: false,
    active: true,
    created_at: new Date().toISOString(),
  }
}
