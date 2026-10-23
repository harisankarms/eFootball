export type Player = {
  id: string
  name: string
  user_id: string | null
  avatar_url: string | null
  is_admin: boolean
  active: boolean
  created_at: string
}

export type MatchStatus = 'ok' | 'disputed'

export type Match = {
  id: string
  played_at: string
  home_id: string
  away_id: string
  home_goals: number
  away_goals: number
  pens_winner_id: string | null
  home_team: string | null
  away_team: string | null
  notes: string | null
  screenshot_path: string | null
  thumb_path: string | null
  submitted_by: string | null
  status: MatchStatus
  dispute_reason: string | null
  disputed_by: string | null
  created_at: string
}

export type Settings = {
  group_name: string
  timezone: string
  potw_win: number
  potw_draw: number
  potw_goal: number
  potw_clean_sheet: number
  potw_min_matches: number
  require_screenshot: boolean
  dispute_hours: number
}

export type JoinRequest = {
  user_id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  created_at: string
}

export type MatchInput = {
  played_at: string
  home_id: string
  away_id: string
  home_goals: number
  away_goals: number
  pens_winner_id: string | null
  home_team: string | null
  away_team: string | null
  notes: string | null
}

/** A compressed screenshot ready to upload: full size plus a small thumbnail. */
export type Shot = { full: Blob; thumb: Blob }

export type Session = { userId: string; email: string | null }

export const DEFAULT_SETTINGS: Settings = {
  group_name: 'Squad League',
  timezone: 'Asia/Kolkata',
  potw_win: 3,
  potw_draw: 1,
  potw_goal: 0.5,
  potw_clean_sheet: 1,
  potw_min_matches: 3,
  require_screenshot: true,
  dispute_hours: 24,
}
