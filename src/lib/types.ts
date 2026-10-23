import type { MatchStats } from './matchStats'

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

/** Which part of a tournament a result belongs to. */
export type Stage = 'league' | 'qf' | 'sf' | 'final'

export type Tournament = {
  id: string
  name: string
  /** How many times everyone plays everyone in the league stage. */
  league_rounds: 1 | 2
  /** Players going through to the knockouts: none, a final, semi-finals or quarter-finals. */
  knockout_size: 0 | 2 | 4 | 8
  /** Whether its results also count in the main table and stats. Fixed when it's created. */
  counts_in_stats: boolean
  created_by: string | null
  created_at: string
  /** Player ids, in the order they were picked. */
  players: string[]
}

export type TournamentInput = Pick<Tournament, 'name' | 'league_rounds' | 'knockout_size' | 'counts_in_stats' | 'players'>

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
  details?: MatchDetails | null
  tournament_id?: string | null
  stage?: Stage | null
  /** False for results of a tournament that is kept out of the main table and stats. Set by the database. */
  in_stats?: boolean
}

/** What was read from the full-time screenshot: the in-game names (home, away) and the stats table. */
export type MatchDetails = { names?: [string | null, string | null]; stats?: MatchStats }

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
  details?: MatchDetails | null
  tournament_id?: string | null
  stage?: Stage | null
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

export type LiveTable = 'matches' | 'match_comments' | 'announcements' | 'tournaments'

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
