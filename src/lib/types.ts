export type Player = {
  id: string
  name: string
  user_id: string | null
  avatar_url: string | null
  /** Cut-out figure shown on Player of the Week cards. */
  card_url: string | null
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

export type Achievement = {
  id: string
  /** Set for the built-in achievements. */
  slug: string | null
  name: string
  description: string
  emoji: string
  xp: number
  /** 'auto' unlocks when a stat reaches the threshold; 'manual' is awarded by an admin. */
  kind: 'auto' | 'manual'
  metric: string | null
  threshold: number | null
  active: boolean
  sort_order: number
  created_at: string
}

export type AchievementInput = Pick<Achievement, 'name' | 'description' | 'emoji' | 'xp' | 'kind' | 'metric' | 'threshold' | 'active'>

export type Award = {
  player_id: string
  achievement_id: string
  awarded_at: string
  awarded_by: string | null
  note: string | null
}

export type Announcement = {
  id: string
  player_id: string
  body: string
  image_path: string | null
  thumb_path: string | null
  created_at: string
}

export type Comment = {
  id: string
  match_id: string
  player_id: string
  body: string
  created_at: string
}

export type LiveTable = 'matches' | 'match_comments' | 'announcements'

export type Session = { userId: string; email: string | null }

export const DEFAULT_SETTINGS: Settings = {
  group_name: 'eFootball Tracker',
  timezone: 'Asia/Kolkata',
  potw_win: 3,
  potw_draw: 1,
  potw_goal: 0.5,
  potw_clean_sheet: 1,
  potw_min_matches: 3,
  require_screenshot: true,
  dispute_hours: 24,
}
