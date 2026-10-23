import type { Api } from './api'
import { DEMO_EMAIL, DEMO_USER_ID, makeDemoData } from './demo-data'
import type { LiveTable, Match, MatchInput, Player, Session, Shot, Tournament } from './types'

/** In-memory backend with sample data. Changes last until the page is reloaded. */
export function createDemoApi(): Api {
  const db = makeDemoData()
  let session: Session | null = { userId: DEMO_USER_ID, email: DEMO_EMAIL }
  const authListeners = new Set<(s: Session | null) => void>()
  const changeListeners = new Set<(table: LiveTable) => void>()

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
  const changed = (table: LiveTable) => changeListeners.forEach((f) => f(table))
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
  /** The same checks the database makes on tournament results, and whether the result counts in the main stats. */
  const tournamentRules = (input: MatchInput): Pick<Match, 'tournament_id' | 'stage' | 'in_stats'> => {
    if (!input.tournament_id) return { tournament_id: null, stage: null, in_stats: true }
    const t = db.tournaments.find((x) => x.id === input.tournament_id)
    if (!t) throw new Error('That tournament no longer exists')
    if (!input.stage) throw new Error('Pick the tournament stage')
    if (!t.players.includes(input.home_id) || !t.players.includes(input.away_id)) throw new Error('Both players have to be in the tournament')
    if (input.stage !== 'league' && input.home_goals === input.away_goals && !input.pens_winner_id)
      throw new Error('A knockout match needs a winner, so add the penalty shootout')
    return { tournament_id: t.id, stage: input.stage, in_stats: t.counts_in_stats }
  }
  const ownTournament = (id: string) => {
    const p = requireMe()
    const t = db.tournaments.find((x) => x.id === id)
    if (!t) throw new Error('Tournament not found.')
    if (!p.is_admin && t.created_by !== p.id) throw deny()
    return t
  }
  const checkBody = (body: string) => {
    const trimmed = body.trim()
    if (trimmed.length < 1 || trimmed.length > 500) throw new Error('body_check')
    return trimmed
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
      const match: Match = {
        id: crypto.randomUUID(),
        ...input,
        ...tournamentRules(input),
        ...shotPaths(shot),
        submitted_by: submittedBy,
        status: 'ok',
        dispute_reason: null,
        disputed_by: null,
        created_at: new Date().toISOString(),
      }
      db.matches.push(match)
      changed('matches')
      return copy(match)
    },
    async updateMatch(match, input, shot) {
      await pause(400)
      requireAdmin()
      validate(input)
      const m = findMatch(match.id)
      Object.assign(m, input, tournamentRules(input), shot ? shotPaths(shot) : {})
      changed('matches')
    },
    async deleteMatch(match) {
      await pause(300)
      const m = findMatch(match.id)
      const p = requireMe()
      if (!p.is_admin && !(m.submitted_by === p.id && withinWindow(m)))
        throw new Error('You can only delete your own results within the dispute window.')
      db.matches = db.matches.filter((x) => x.id !== m.id)
      db.comments = db.comments.filter((c) => c.match_id !== m.id)
      changed('matches')
    },
    async disputeMatch(matchId, reason) {
      await pause(300)
      const m = findMatch(matchId)
      const p = requireMe()
      if (![m.home_id, m.away_id].includes(p.id) || m.submitted_by === p.id)
        throw new Error('Only the other player in this match can dispute it')
      if (!withinWindow(m)) throw new Error(`The ${db.settings.dispute_hours} hour dispute window has closed`)
      Object.assign(m, { status: 'disputed', dispute_reason: reason.trim().slice(0, 200) || null, disputed_by: p.id })
      changed('matches')
    },
    async resolveDispute(matchId) {
      await pause(300)
      requireAdmin()
      Object.assign(findMatch(matchId), { status: 'ok', dispute_reason: null, disputed_by: null })
      changed('matches')
    },
    async updateMyName(name) {
      await pause(300)
      const trimmed = name.trim()
      if (trimmed.length < 1 || trimmed.length > 40) throw new Error('Name must be between 1 and 40 characters')
      requireMe().name = trimmed
    },
    async setAvatar(player, photo, self) {
      await pause(300)
      const actor = requireMe()
      if (!self && !actor.is_admin) throw deny()
      const target = db.players.find((p) => p.id === (self ? actor.id : player.id))
      if (!target) throw new Error('Player not found.')
      target.avatar_url = photo ? URL.createObjectURL(photo) : null
    },
    async setCardFigure(player, figure, self) {
      await pause(300)
      const actor = requireMe()
      if (!self && !actor.is_admin) throw deny()
      const target = db.players.find((p) => p.id === (self ? actor.id : player.id))
      if (!target) throw new Error('Player not found.')
      target.card_url = figure ? URL.createObjectURL(figure) : null
    },

    async getAchievements() {
      await pause(80)
      return copy(db.achievements)
    },
    async saveAchievement(input, id) {
      await pause(300)
      requireAdmin()
      const row = { ...input, metric: input.kind === 'auto' ? input.metric : null, threshold: input.kind === 'auto' ? input.threshold : null }
      if (id) {
        const a = db.achievements.find((x) => x.id === id)
        if (!a) throw new Error('Achievement not found.')
        Object.assign(a, row)
      } else {
        db.achievements.push({ id: crypto.randomUUID(), slug: null, sort_order: 1000, created_at: new Date().toISOString(), ...row })
      }
    },
    async deleteAchievement(id) {
      await pause(300)
      requireAdmin()
      db.achievements = db.achievements.filter((a) => a.id !== id)
      db.awards = db.awards.filter((w) => w.achievement_id !== id)
    },
    async getAwards() {
      await pause(80)
      return copy(db.awards)
    },
    async setAward(playerId, achievementId, awarded, awardedBy) {
      await pause(250)
      requireAdmin()
      db.awards = db.awards.filter((w) => !(w.player_id === playerId && w.achievement_id === achievementId))
      if (awarded)
        db.awards.push({ player_id: playerId, achievement_id: achievementId, awarded_at: new Date().toISOString(), awarded_by: awardedBy, note: null })
    },

    async getAnnouncements() {
      await pause(100)
      return copy(db.announcements).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    },
    async postAnnouncement(body, shot, playerId) {
      await pause(400)
      if (requireMe().id !== playerId) throw deny()
      const paths = shotPaths(shot)
      db.announcements.push({
        id: crypto.randomUUID(),
        player_id: playerId,
        body: checkBody(body),
        image_path: paths.screenshot_path,
        thumb_path: paths.thumb_path,
        created_at: new Date().toISOString(),
      })
      changed('announcements')
    },
    async deleteAnnouncement(a) {
      await pause(250)
      const p = requireMe()
      if (!p.is_admin && a.player_id !== p.id) throw deny()
      db.announcements = db.announcements.filter((x) => x.id !== a.id)
      changed('announcements')
    },

    async getComments() {
      await pause(80)
      return copy(db.comments)
    },
    async addComment(matchId, body, playerId) {
      await pause(250)
      if (requireMe().id !== playerId) throw deny()
      findMatch(matchId)
      db.comments.push({ id: crypto.randomUUID(), match_id: matchId, player_id: playerId, body: checkBody(body), created_at: new Date().toISOString() })
      changed('match_comments')
    },
    async deleteComment(id) {
      await pause(200)
      const p = requireMe()
      const c = db.comments.find((x) => x.id === id)
      if (!c) return
      if (!p.is_admin && c.player_id !== p.id) throw deny()
      db.comments = db.comments.filter((x) => x.id !== id)
      changed('match_comments')
    },

    async getTournaments() {
      await pause(80)
      return copy(db.tournaments).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    },
    async createTournament(input) {
      await pause(400)
      const p = requireMe()
      const name = input.name.trim()
      if (!name) throw new Error('Give the tournament a name')
      const ids = [...new Set(input.players)]
      if (ids.length !== input.players.length || ids.some((id) => !db.players.some((x) => x.id === id && x.active)))
        throw new Error('Pick each player once, from the active squad')
      if (ids.length < 2 || ids.length > 16) throw new Error('A tournament needs 2 to 16 players')
      if (input.knockout_size > ids.length) throw new Error('Not enough players for those knockouts')
      const t: Tournament = {
        id: crypto.randomUUID(),
        name: name.slice(0, 60),
        league_rounds: input.league_rounds,
        knockout_size: input.knockout_size,
        counts_in_stats: input.counts_in_stats,
        created_by: p.id,
        created_at: new Date().toISOString(),
        players: ids,
      }
      db.tournaments.push(t)
      changed('tournaments')
      return t.id
    },
    async renameTournament(id, name) {
      await pause(250)
      const t = ownTournament(id)
      const trimmed = name.trim()
      if (trimmed.length < 1 || trimmed.length > 60) throw new Error('Names are 1 to 60 characters')
      t.name = trimmed
      changed('tournaments')
    },
    async deleteTournament(id) {
      await pause(250)
      ownTournament(id)
      if (db.matches.some((m) => m.tournament_id === id)) throw new Error("A tournament with results can't be deleted.")
      db.tournaments = db.tournaments.filter((x) => x.id !== id)
      changed('tournaments')
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
    card_url: null,
    is_admin: false,
    active: true,
    created_at: new Date().toISOString(),
  }
}
