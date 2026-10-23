import { createClient } from '@supabase/supabase-js'
import type { Api } from './api'
import type { Achievement, Announcement, Award, Comment, JoinRequest, LiveTable, Match, Player, Session, Settings, Shot, Tournament } from './types'

type TournamentRow = Omit<Tournament, 'players'> & { tournament_players: { player_id: string; position: number }[] }

const BUCKET = 'screenshots'
const AVATARS = 'avatars'
const PAGE = 1000

type Result<T> = { data: T | null; error: { message: string } | null }

function must<T>(res: Result<T>): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

function toSettings(row: Record<string, unknown>): Settings {
  return {
    group_name: String(row.group_name),
    timezone: String(row.timezone),
    potw_win: Number(row.potw_win),
    potw_draw: Number(row.potw_draw),
    potw_goal: Number(row.potw_goal),
    potw_clean_sheet: Number(row.potw_clean_sheet),
    potw_min_matches: Number(row.potw_min_matches),
    require_screenshot: Boolean(row.require_screenshot),
    dispute_hours: Number(row.dispute_hours),
  }
}

const denied = () => new Error("You don't have permission to do that.")

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  })
  const bucket = () => sb.storage.from(BUCKET)

  const toSession = (s: { user: { id: string; email?: string | null } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? null } : null

  async function uploadShot(shot: Shot, prefix = '') {
    const id = crypto.randomUUID()
    const folder = `${prefix}${new Date().toISOString().slice(0, 7)}`
    const ext = shot.full.type === 'image/webp' ? 'webp' : 'jpg'
    const paths = { screenshot_path: `${folder}/${id}.${ext}`, thumb_path: `${folder}/${id}-thumb.${ext}` }
    const opts = { cacheControl: '31536000', contentType: shot.full.type, upsert: false }
    must(await bucket().upload(paths.screenshot_path, shot.full, opts))
    try {
      must(await bucket().upload(paths.thumb_path, shot.thumb, opts))
    } catch (e) {
      await bucket().remove([paths.screenshot_path])
      throw e
    }
    return paths
  }

  async function removeFiles(...paths: (string | null)[]) {
    const list = paths.filter((p): p is string => !!p)
    if (list.length) await bucket().remove(list).catch(() => undefined)
  }

  /**
   * Uploads a player's photo or card figure into their folder, points the player at it (through the
   * player's own function, or as admin), and removes the image it replaces.
   */
  async function replaceImage(
    player: Player,
    image: Blob | null,
    self: boolean,
    column: 'avatar_url' | 'card_url',
    rpc: 'update_my_avatar' | 'update_my_card',
    prefix: string,
  ) {
    let newPath: string | null = null
    let newUrl: string | null = null
    if (image) {
      const ext = image.type === 'image/webp' ? 'webp' : image.type === 'image/png' ? 'png' : 'jpg'
      newPath = `${player.id}/${prefix}${crypto.randomUUID()}.${ext}`
      must(await sb.storage.from(AVATARS).upload(newPath, image, { cacheControl: '31536000', contentType: image.type, upsert: false }))
      newUrl = sb.storage.from(AVATARS).getPublicUrl(newPath).data.publicUrl
    }
    try {
      if (self) {
        must(await sb.rpc(rpc, { p_url: newUrl }))
      } else {
        const res = await sb.from('players').update({ [column]: newUrl }, { count: 'exact' }).eq('id', player.id)
        if (res.error) throw new Error(res.error.message)
        if (res.count === 0) throw denied()
      }
    } catch (e) {
      if (newPath) await sb.storage.from(AVATARS).remove([newPath]).catch(() => undefined)
      throw e
    }
    const oldPath = player[column]?.split(`/storage/v1/object/public/${AVATARS}/`)[1]
    if (oldPath) await sb.storage.from(AVATARS).remove([decodeURIComponent(oldPath)]).catch(() => undefined)
  }

  /** The API returns at most 1000 rows per request, so page until an empty page comes back. */
  async function fetchAll<T>(table: string, order: string, ascending: boolean): Promise<T[]> {
    const all: T[] = []
    for (let from = 0; ; ) {
      const rows = must(
        await sb
          .from(table)
          .select('*')
          .order(order, { ascending })
          .order('id')
          .range(from, from + PAGE - 1),
      ) as T[]
      all.push(...rows)
      if (rows.length === 0) return all
      from += rows.length
    }
  }

  return {
    mode: 'live',

    async getAuthOptions() {
      try {
        const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
        const data = res.ok ? await res.json() : null
        return { google: !!data?.external?.google }
      } catch {
        return { google: false }
      }
    },
    async getSession() {
      const { data } = await sb.auth.getSession()
      return toSession(data.session)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toSession(session)))
      return () => data.subscription.unsubscribe()
    },
    async signInWithGoogle() {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw new Error(error.message)
    },
    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signUpWithPassword(email, password, name) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
      })
      if (error) throw new Error(error.message)
      return { needsConfirmation: !data.session }
    },
    async signOut() {
      const { error } = await sb.auth.signOut()
      if (error) throw new Error(error.message)
    },
    async linkMe() {
      return (must(await sb.rpc('link_my_player')) as Player | null) ?? null
    },

    async getPlayers() {
      return must(await sb.from('players').select('*').order('created_at').order('id')) as Player[]
    },
    getMatches: () => fetchAll<Match>('matches', 'played_at', false),
    async getSettings() {
      return toSettings(must(await sb.from('settings').select('*').eq('id', 1).single()))
    },
    subscribe(onChange) {
      const channel = sb.channel('live-changes')
      for (const table of ['matches', 'match_comments', 'announcements', 'tournaments'] as LiveTable[]) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange(table))
      }
      channel.subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },

    async addMatch(input, shot, submittedBy) {
      const paths = shot ? await uploadShot(shot) : { screenshot_path: null, thumb_path: null }
      const res = await sb
        .from('matches')
        .insert({ ...input, ...paths, submitted_by: submittedBy })
        .select()
        .single()
      if (res.error) {
        await removeFiles(paths.screenshot_path, paths.thumb_path)
        throw new Error(res.error.message)
      }
      return res.data as Match
    },
    async updateMatch(match, input, shot) {
      const paths = shot
        ? await uploadShot(shot)
        : { screenshot_path: match.screenshot_path, thumb_path: match.thumb_path }
      const res = await sb.from('matches').update({ ...input, ...paths }, { count: 'exact' }).eq('id', match.id)
      if (res.error || res.count === 0) {
        if (shot) await removeFiles(paths.screenshot_path, paths.thumb_path)
        throw new Error(res.error?.message ?? "You don't have permission to edit this match.")
      }
      if (shot) await removeFiles(match.screenshot_path, match.thumb_path)
    },
    async deleteMatch(match) {
      const res = await sb.from('matches').delete({ count: 'exact' }).eq('id', match.id)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw new Error('You can only delete your own results within the dispute window.')
      await removeFiles(match.screenshot_path, match.thumb_path)
    },
    async disputeMatch(matchId, reason) {
      must(await sb.rpc('dispute_match', { p_match_id: matchId, p_reason: reason }))
    },
    async resolveDispute(matchId) {
      const res = await sb
        .from('matches')
        .update({ status: 'ok', dispute_reason: null, disputed_by: null }, { count: 'exact' })
        .eq('id', matchId)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
    },
    async updateMyName(name) {
      must(await sb.rpc('update_my_name', { p_name: name }))
    },
    setAvatar: (player, photo, self) => replaceImage(player, photo, self, 'avatar_url', 'update_my_avatar', ''),
    setCardFigure: (player, figure, self) => replaceImage(player, figure, self, 'card_url', 'update_my_card', 'card-'),

    async getAchievements() {
      return must(await sb.from('achievements').select('*').order('sort_order').order('created_at')) as Achievement[]
    },
    async saveAchievement(input, id) {
      const row = {
        ...input,
        name: input.name.trim(),
        description: input.description.trim(),
        metric: input.kind === 'auto' ? input.metric : null,
        threshold: input.kind === 'auto' ? input.threshold : null,
      }
      if (id) {
        const res = await sb.from('achievements').update(row, { count: 'exact' }).eq('id', id)
        if (res.error) throw new Error(res.error.message)
        if (res.count === 0) throw denied()
      } else {
        must(await sb.from('achievements').insert(row))
      }
    },
    async deleteAchievement(id) {
      const res = await sb.from('achievements').delete({ count: 'exact' }).eq('id', id)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
    },
    async getAwards() {
      return must(await sb.from('player_achievements').select('*')) as Award[]
    },
    async setAward(playerId, achievementId, awarded, awardedBy) {
      if (awarded) {
        must(
          await sb
            .from('player_achievements')
            .upsert({ player_id: playerId, achievement_id: achievementId, awarded_by: awardedBy }, { onConflict: 'player_id,achievement_id', ignoreDuplicates: true }),
        )
      } else {
        must(await sb.from('player_achievements').delete().eq('player_id', playerId).eq('achievement_id', achievementId))
      }
    },

    getAnnouncements: () => fetchAll<Announcement>('announcements', 'created_at', false),
    async postAnnouncement(body, shot, playerId) {
      const paths = shot ? await uploadShot(shot, 'news/') : { screenshot_path: null, thumb_path: null }
      const res = await sb
        .from('announcements')
        .insert({ player_id: playerId, body: body.trim(), image_path: paths.screenshot_path, thumb_path: paths.thumb_path })
      if (res.error) {
        await removeFiles(paths.screenshot_path, paths.thumb_path)
        throw new Error(res.error.message)
      }
    },
    async deleteAnnouncement(a) {
      const res = await sb.from('announcements').delete({ count: 'exact' }).eq('id', a.id)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
      await removeFiles(a.image_path, a.thumb_path)
    },

    async getTournaments() {
      const rows = must(
        await sb.from('tournaments').select('*, tournament_players(player_id, position)').order('created_at', { ascending: false }),
      ) as TournamentRow[]
      return rows.map(({ tournament_players, ...t }) => ({
        ...t,
        players: [...tournament_players].sort((a, b) => a.position - b.position).map((p) => p.player_id),
      }))
    },
    async createTournament(input) {
      return must(
        await sb.rpc('create_tournament', {
          p_name: input.name,
          p_players: input.players,
          p_league_rounds: input.league_rounds,
          p_knockout_size: input.knockout_size,
          p_counts_in_stats: input.counts_in_stats,
        }),
      ) as string
    },
    async renameTournament(id, name) {
      const res = await sb.from('tournaments').update({ name: name.trim() }, { count: 'exact' }).eq('id', id)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
    },
    async deleteTournament(id) {
      const res = await sb.from('tournaments').delete({ count: 'exact' }).eq('id', id)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
    },

    getComments: () => fetchAll<Comment>('match_comments', 'created_at', true),
    async addComment(matchId, body, playerId) {
      must(await sb.from('match_comments').insert({ match_id: matchId, player_id: playerId, body: body.trim() }))
    },
    async deleteComment(id) {
      const res = await sb.from('match_comments').delete({ count: 'exact' }).eq('id', id)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
    },

    async getJoinRequests() {
      return must(await sb.from('join_requests').select('*').order('created_at')) as JoinRequest[]
    },
    async approveJoin(userId, playerId) {
      must(await sb.rpc('approve_join', { p_user_id: userId, p_player_id: playerId }))
    },
    async rejectJoin(userId) {
      must(await sb.from('join_requests').delete().eq('user_id', userId))
    },
    async addPlayer(name) {
      must(await sb.from('players').insert({ name: name.trim() }))
    },
    async updatePlayer(id, patch) {
      const res = await sb.from('players').update(patch, { count: 'exact' }).eq('id', id)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
    },
    async updateSettings(patch) {
      const res = await sb.from('settings').update(patch, { count: 'exact' }).eq('id', 1)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw denied()
    },

    imageUrl(path) {
      return path ? bucket().getPublicUrl(path).data.publicUrl : null
    },
  }
}
