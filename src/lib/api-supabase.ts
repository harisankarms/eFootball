import { createClient } from '@supabase/supabase-js'
import type { Api } from './api'
import type { JoinRequest, Match, Player, Session, Settings, Shot } from './types'

const BUCKET = 'screenshots'
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

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  })
  const bucket = () => sb.storage.from(BUCKET)

  const toSession = (s: { user: { id: string; email?: string | null } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? null } : null

  async function uploadShot(shot: Shot) {
    const id = crypto.randomUUID()
    const folder = new Date().toISOString().slice(0, 7)
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
    async getMatches() {
      // The API returns at most 1000 rows per request, so page until a short page comes back.
      const all: Match[] = []
      for (let from = 0; ; ) {
        const rows = must(
          await sb
            .from('matches')
            .select('*')
            .order('played_at', { ascending: false })
            .order('id')
            .range(from, from + PAGE - 1),
        ) as Match[]
        all.push(...rows)
        if (rows.length === 0) return all
        from += rows.length
      }
    },
    async getSettings() {
      return toSettings(must(await sb.from('settings').select('*').eq('id', 1).single()))
    },
    subscribe(onChange) {
      const channel = sb
        .channel('matches-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => onChange())
        .subscribe()
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
      if (res.count === 0) throw new Error("You don't have permission to do that.")
    },
    async updateMyName(name) {
      must(await sb.rpc('update_my_name', { p_name: name }))
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
      if (res.count === 0) throw new Error("You don't have permission to do that.")
    },
    async updateSettings(patch) {
      const res = await sb.from('settings').update(patch, { count: 'exact' }).eq('id', 1)
      if (res.error) throw new Error(res.error.message)
      if (res.count === 0) throw new Error("You don't have permission to do that.")
    },

    imageUrl(path) {
      return path ? bucket().getPublicUrl(path).data.publicUrl : null
    },
  }
}
