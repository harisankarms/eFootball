import type {
  Achievement,
  AchievementInput,
  Announcement,
  Award,
  Comment,
  JoinRequest,
  LiveTable,
  Match,
  MatchInput,
  Player,
  Session,
  Settings,
  Shot,
  Tournament,
  TournamentInput,
} from './types'

/** Everything the screens need from the backend. Implemented by Supabase (live) and by the in-memory demo. */
export interface Api {
  mode: 'live' | 'demo'

  /** Which sign-in methods are switched on. Google only shows once it's enabled in Supabase. */
  getAuthOptions(): Promise<{ google: boolean }>
  getSession(): Promise<Session | null>
  onAuthChange(cb: (session: Session | null) => void): () => void
  signInWithGoogle(): Promise<void>
  signInWithPassword(email: string, password: string): Promise<void>
  signUpWithPassword(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  /** The signed-in account's player, or null while they wait for approval. */
  linkMe(): Promise<Player | null>

  getPlayers(): Promise<Player[]>
  getMatches(): Promise<Match[]>
  getSettings(): Promise<Settings>
  /** Calls `onChange` whenever someone changes a match, comment or announcement. Returns an unsubscribe function. */
  subscribe(onChange: (table: LiveTable) => void): () => void

  addMatch(input: MatchInput, shot: Shot | null, submittedBy: string): Promise<Match>
  updateMatch(match: Match, input: MatchInput, shot: Shot | null): Promise<void>
  deleteMatch(match: Match): Promise<void>
  disputeMatch(matchId: string, reason: string): Promise<void>
  resolveDispute(matchId: string): Promise<void>
  updateMyName(name: string): Promise<void>
  /** Uploads a new profile photo (or removes it with null). `self` uses the player's own permission, otherwise admin. */
  setAvatar(player: Player, photo: Blob | null, self: boolean): Promise<void>
  /** Uploads the cut-out figure for the Player of the Week cards (or removes it with null). */
  setCardFigure(player: Player, figure: Blob | null, self: boolean): Promise<void>

  getAchievements(): Promise<Achievement[]>
  /** Creates an achievement, or updates it when `id` is given. Admin only. */
  saveAchievement(input: AchievementInput, id: string | null): Promise<void>
  deleteAchievement(id: string): Promise<void>
  getAwards(): Promise<Award[]>
  setAward(playerId: string, achievementId: string, awarded: boolean, awardedBy: string): Promise<void>

  getAnnouncements(): Promise<Announcement[]>
  postAnnouncement(body: string, shot: Shot | null, playerId: string): Promise<void>
  deleteAnnouncement(announcement: Announcement): Promise<void>

  getComments(): Promise<Comment[]>
  addComment(matchId: string, body: string, playerId: string): Promise<void>
  deleteComment(id: string): Promise<void>

  getTournaments(): Promise<Tournament[]>
  /** Creates a tournament and returns its id. */
  createTournament(input: TournamentInput): Promise<string>
  renameTournament(id: string, name: string): Promise<void>
  /** Only works while the tournament has no results. */
  deleteTournament(id: string): Promise<void>

  getJoinRequests(): Promise<JoinRequest[]>
  approveJoin(userId: string, playerId: string | null): Promise<void>
  rejectJoin(userId: string): Promise<void>
  addPlayer(name: string): Promise<void>
  updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'active' | 'is_admin'>>): Promise<void>
  updateSettings(patch: Partial<Settings>): Promise<void>

  imageUrl(path: string | null): string | null
}

export function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong.'
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Can't reach the database. Check your connection. If nobody has used the site for a week, the free Supabase project may be paused: restore it from the Supabase dashboard."
  }
  if (/row-level security|permission denied/i.test(message)) return "You don't have permission to do that."
  if (/different_players/.test(message)) return 'Pick two different players.'
  if (/pens_only_after_a_draw/.test(message)) return 'Penalties only happen after a draw.'
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.'
  if (/body_check/.test(message)) return 'Write something first (up to 500 characters).'
  if (/matches_tournament_id_fkey/.test(message)) return "A tournament with results can't be deleted."
  return message
}
