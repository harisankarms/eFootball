// Sample squad and six weeks of results so the site can be explored before a
// database is connected. Seeded, so the demo looks the same on every load.
import type { MatchStats } from './matchStats'
import { addDays, dayKey, startOfDay } from './time'
import {
  DEFAULT_SETTINGS,
  type Achievement,
  type Announcement,
  type Award,
  type Comment,
  type JoinRequest,
  type Match,
  type Player,
  type Settings,
  type Stage,
  type Tournament,
} from './types'

export const DEMO_USER_ID = 'demo-user-1'
export const DEMO_EMAIL = 'hari@example.com'

const SQUAD = [
  { name: 'Hari', skill: 1.1 },
  { name: 'Sam', skill: 1.15 },
  { name: 'Alex', skill: 0.9 },
  { name: 'Jay', skill: 1.0 },
  { name: 'Leo', skill: 0.75 },
  { name: 'Nik', skill: 0.95 },
]
const TEAMS = ['Real Madrid', 'Barcelona', 'Man City', 'Liverpool', 'Bayern', 'Arsenal', 'PSG', 'Inter', 'Dream Team', 'Argentina', 'Brazil', 'France']
const NOTES = ['Last-minute winner!', 'Rematch tomorrow.', 'Absolute robbery.', 'Hat-trick from the striker.', 'Comeback from 2-0 down.']

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function poisson(rand: () => number, lambda: number) {
  const limit = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rand()
  } while (p > limit)
  return k - 1
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** A fake "full time" screen drawn as SVG, standing in for a real screenshot. */
export function demoScreenshot(home: string, away: string, hg: number, ag: number, pensWinner?: string): string {
  const t = (x: number, y: number, size: number, text: string, extra = '') =>
    `<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" text-anchor="middle" ${extra}>${escapeXml(text)}</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="432" viewBox="0 0 960 432">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f5a3a"/><stop offset="1" stop-color="#06243a"/></linearGradient></defs>
<rect width="960" height="432" fill="url(#g)"/>
<g stroke="#fff" stroke-opacity=".14" stroke-width="3" fill="none"><rect x="28" y="28" width="904" height="376"/><line x1="480" y1="28" x2="480" y2="404"/><circle cx="480" cy="216" r="72"/><rect x="28" y="126" width="110" height="180"/><rect x="822" y="126" width="110" height="180"/></g>
<rect x="330" y="58" width="300" height="44" rx="8" fill="#000" fill-opacity=".45"/>
${t(480, 88, 22, 'FULL TIME', 'font-weight="700" fill="#d6ecff" letter-spacing="5"')}
${t(480, 252, 120, `${hg} - ${ag}`, 'font-weight="800" fill="#fff"')}
${t(190, 236, 44, home.toUpperCase(), 'font-weight="700" fill="#fff"')}
${t(770, 236, 44, away.toUpperCase(), 'font-weight="700" fill="#fff"')}
${pensWinner ? t(480, 330, 26, `${pensWinner} wins on penalties`, 'font-weight="700" fill="#ffd36b"') : ''}
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// Same built-in list as supabase/setup.sql.
const PRESETS: [string, string, string, string, number, 'auto' | 'manual', string | null, number | null][] = [
  ['kick-off', 'Kick-off', 'Play your first match', '⚽', 25, 'auto', 'matches_played', 1],
  ['first-win', 'First Win', 'Win your first match', '🎉', 50, 'auto', 'wins', 1],
  ['regular', 'Regular', 'Play 25 matches', '🎮', 100, 'auto', 'matches_played', 25],
  ['seasoned-pro', 'Seasoned Pro', 'Play 100 matches', '🎖️', 250, 'auto', 'matches_played', 100],
  ['club-legend', 'Club Legend', 'Play 250 matches', '🏟️', 500, 'auto', 'matches_played', 250],
  ['winning-mentality', 'Winning Mentality', 'Win 10 matches', '💪', 100, 'auto', 'wins', 10],
  ['serial-winner', 'Serial Winner', 'Win 50 matches', '🏅', 300, 'auto', 'wins', 50],
  ['centurion', 'Centurion', 'Win 100 matches', '💯', 600, 'auto', 'wins', 100],
  ['hat-trick-hero', 'Hat-trick Hero', 'Score 3 goals in one match', '🎩', 75, 'auto', 'goals_in_match', 3],
  ['five-star-show', 'Five-Star Show', 'Score 5 goals in one match', '🖐️', 150, 'auto', 'goals_in_match', 5],
  ['goal-machine', 'Goal Machine', 'Score 50 goals', '🎯', 150, 'auto', 'goals', 50],
  ['golden-century', 'Golden Century', 'Score 100 goals', '🚀', 300, 'auto', 'goals', 100],
  ['shut-out', 'Shut Out', 'Keep a clean sheet', '🧤', 50, 'auto', 'clean_sheets', 1],
  ['brick-wall', 'Brick Wall', 'Keep 10 clean sheets', '🧱', 150, 'auto', 'clean_sheets', 10],
  ['thrashing', 'Thrashing', 'Win by 5 or more goals', '💥', 125, 'auto', 'win_margin', 5],
  ['on-fire', 'On Fire', 'Win 3 matches in a row', '🔥', 75, 'auto', 'win_streak', 3],
  ['unstoppable', 'Unstoppable', 'Win 7 matches in a row', '⚡', 200, 'auto', 'win_streak', 7],
  ['invincible', 'Invincible', 'Go 10 matches unbeaten', '🛡️', 200, 'auto', 'unbeaten_run', 10],
  ['ice-cold', 'Ice Cold', 'Win a penalty shootout', '🧊', 75, 'auto', 'pens_wins', 1],
  ['player-of-the-week', 'Player of the Week', 'Win Player of the Week', '👑', 200, 'auto', 'potw', 1],
  ['dynasty', 'Dynasty', 'Win Player of the Week 5 times', '🏆', 500, 'auto', 'potw', 5],
  ['golden-boot', 'Golden Boot', 'Finish a week as top scorer', '👟', 100, 'auto', 'golden_boots', 1],
  ['squad-conqueror', 'Squad Conqueror', 'Beat 5 different opponents', '⚔️', 150, 'auto', 'opponents_beaten', 5],
  ['all-nighter', 'All-Nighter', 'Play 10 matches in one day', '🌙', 100, 'auto', 'matches_in_day', 10],
  ['statistician', 'Statistician', 'Log 25 results', '📸', 75, 'auto', 'results_logged', 25],
  ['passmaster', 'Passmaster', 'Complete 90% of your passes in a match (30+ passes)', '🎼', 100, 'auto', 'pass_accuracy', 90],
  ['fortress', 'Fortress', 'Keep your opponent to zero shots on target', '🏰', 100, 'auto', 'zero_shots_against', 1],
  ['tiki-taka', 'Tiki-Taka', 'Have 65% possession in a match', '🔄', 75, 'auto', 'possession', 65],
  ['sharpshooter', 'Sharpshooter', 'Put 10 shots on target in a match', '🏹', 100, 'auto', 'shots_on_target_in_match', 10],
  ['ball-winner', 'Ball Winner', 'Make 25 tackles in a match', '🦾', 75, 'auto', 'tackles_in_match', 25],
  ['epic-pull', 'Epic Pull', 'Pack an Epic or Big Time card in eFootball', '💎', 100, 'manual', null, null],
  ['division-one', 'Division 1', 'Reach Division 1 in eFootball ranked matches', '🏔️', 300, 'manual', null, null],
  ['bicycle-kick', 'Bicycle Kick', 'Score a bicycle kick and post the clip', '🤸', 50, 'manual', null, null],
  ['tournament-winner', 'Tournament Winner', 'Win an eFootball online tournament or event', '🥇', 250, 'manual', null, null],
]

/** An illustrated, transparent "player figure" standing in for an uploaded cut-out. */
function demoFigure(kit: string, kitDark: string, skin: string, hair: string, number: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600">
<defs>
<linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${kit}"/><stop offset="1" stop-color="${kitDark}"/></linearGradient>
<radialGradient id="s" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="${skin}"/><stop offset="1" stop-color="#8a5a3a"/></radialGradient>
</defs>
<path d="M30 600 C34 470 70 408 150 384 L205 364 Q240 396 275 364 L330 384 C410 408 446 470 450 600 Z" fill="url(#k)"/>
<path d="M95 600 L110 470 M385 600 L370 470" stroke="#000" stroke-opacity=".18" stroke-width="8"/>
<path d="M212 298 L268 298 L273 372 Q240 394 207 372 Z" fill="${skin}"/>
<path d="M200 366 Q240 402 280 366" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="10"/>
<ellipse cx="164" cy="246" rx="11" ry="20" fill="${skin}"/>
<ellipse cx="316" cy="246" rx="11" ry="20" fill="${skin}"/>
<ellipse cx="240" cy="236" rx="78" ry="93" fill="url(#s)"/>
<path d="M160 228 C158 140 204 124 242 124 C292 124 324 148 322 228 C306 182 282 168 240 168 C200 168 176 182 160 228 Z" fill="${hair}"/>
<text x="240" y="545" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="104" fill="#fff" fill-opacity=".92" text-anchor="middle">${number}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function demoCardImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
<defs>
<radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#3b1d6e"/><stop offset="1" stop-color="#0b0820"/></radialGradient>
<linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".45" stop-color="#ffcf4d"/><stop offset="1" stop-color="#d97706"/></linearGradient>
</defs>
<rect width="960" height="540" fill="url(#bg)"/>
<g opacity=".35" stroke="#ffd36b" stroke-width="3">${Array.from({ length: 14 }, (_, i) => `<line x1="480" y1="270" x2="${480 + Math.cos(i / 2.2) * 700}" y2="${270 + Math.sin(i / 2.2) * 700}"/>`).join('')}</g>
<rect x="370" y="70" width="220" height="320" rx="22" fill="url(#card)"/>
<text x="400" y="130" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="#3b2300">97</text>
<text x="402" y="160" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#3b2300">AMF</text>
<circle cx="480" cy="250" r="62" fill="#3b2300" fill-opacity=".18"/>
<text x="480" y="352" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="#3b2300" text-anchor="middle">BIG TIME</text>
<text x="480" y="460" font-family="Arial,sans-serif" font-size="34" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="3">NEW SIGNING!</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export type DemoDb = {
  players: Player[]
  matches: Match[]
  tournaments: Tournament[]
  settings: Settings
  joinRequests: JoinRequest[]
  achievements: Achievement[]
  awards: Award[]
  announcements: Announcement[]
  comments: Comment[]
}

/** A believable full-time stats table for a demo result, leaning towards the stronger player. */
function demoStats(r: () => number, hg: number, ag: number, homeSkill: number, awaySkill: number): MatchStats {
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
  const share = Math.min(68, Math.max(32, Math.round(50 + (homeSkill - awaySkill) * 12 + (r() - 0.5) * 16)))
  const shots = (goals: number, skill: number) => goals + Math.round(3 + r() * 8 * skill)
  const onTarget = (goals: number, total: number) => Math.min(total, goals + Math.round(r() * (total - goals) * 0.6))
  const passes = (possession: number) => Math.round(90 + possession * 2.4 + r() * 40)
  const completed = (n: number) => Math.round(n * (0.7 + r() * 0.22))
  const hs = shots(hg, homeSkill)
  const as = shots(ag, awaySkill)
  const hot = onTarget(hg, hs)
  const aot = onTarget(ag, as)
  const hp = passes(share)
  const ap = passes(100 - share)
  return {
    possession: [share, 100 - share],
    shots: [hs, as],
    shots_on_target: [hot, aot],
    fouls: [int(0, 4), int(0, 4)],
    offsides: [int(0, 3), int(0, 3)],
    corners: [int(0, 8), int(0, 8)],
    free_kicks: [int(0, 4), int(0, 4)],
    passes: [hp, ap],
    successful_passes: [completed(hp), completed(ap)],
    crosses: [int(0, 5), int(0, 5)],
    interceptions: [int(10, 40), int(10, 40)],
    tackles: [int(5, 24), int(5, 24)],
    saves: [Math.max(0, aot - ag), Math.max(0, hot - hg)],
  }
}

export function makeDemoData(now = new Date()): DemoDb {
  const rand = mulberry32(20261023)
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]
  const tz = DEFAULT_SETTINGS.timezone
  const today = dayKey(now, tz)
  const founded = startOfDay(addDays(today, -45), tz).getTime()

  const players: Player[] = SQUAD.map((p, i) => ({
    id: `demo-player-${i + 1}`,
    name: p.name,
    user_id: i === 0 ? DEMO_USER_ID : i < 4 ? `demo-user-${i + 1}` : null,
    avatar_url: null,
    card_url:
      p.name === 'Jay'
        ? demoFigure('#f5b301', '#3a2600', '#d9a27a', '#1a1008', 10)
        : p.name === 'Sam'
          ? demoFigure('#e4572e', '#5c1408', '#e6b994', '#3b2416', 7)
          : null,
    is_admin: i === 0,
    active: true,
    created_at: new Date(founded + i * 60_000).toISOString(),
  }))
  const skill = (p: Player) => SQUAD[players.indexOf(p)].skill

  const matches: Match[] = []
  let seq = 0
  for (let back = 41; back >= 0; back--) {
    const dayStart = startOfDay(addDays(today, -back), tz).getTime()
    const games = 2 + Math.floor(rand() * 4)
    const lineup = [...players].sort(() => rand() - 0.5).slice(0, 3 + Math.floor(rand() * 3))
    for (let g = 0; g < games; g++) {
      const at =
        back === 0
          ? now.getTime() - (games - g) * 47 * 60_000
          : dayStart + (19 * 60 + g * 38 + Math.floor(rand() * 20)) * 60_000
      const home = pick(lineup)
      let away = pick(lineup)
      while (away === home) away = pick(lineup)
      const hg = Math.min(9, poisson(rand, (1.55 * skill(home)) / skill(away)))
      const ag = Math.min(9, poisson(rand, (1.45 * skill(away)) / skill(home)))
      const pens = hg === ag && rand() < 0.3 ? (rand() < 0.5 ? home : away) : null
      const withTeams = rand() < 0.55
      const shot = demoScreenshot(home.name, away.name, hg, ag, pens?.name)
      seq++
      matches.push({
        id: `demo-match-${seq}`,
        played_at: new Date(at).toISOString(),
        home_id: home.id,
        away_id: away.id,
        home_goals: hg,
        away_goals: ag,
        pens_winner_id: pens?.id ?? null,
        home_team: withTeams ? pick(TEAMS) : null,
        away_team: withTeams ? pick(TEAMS) : null,
        notes: rand() < 0.12 ? pick(NOTES) : null,
        screenshot_path: shot,
        thumb_path: shot,
        submitted_by: rand() < 0.5 ? home.id : away.id,
        status: 'ok',
        dispute_reason: null,
        disputed_by: null,
        created_at: new Date(at + (3 + Math.floor(rand() * 10)) * 60_000).toISOString(),
      })
    }
  }

  // Two tournaments: a finished one kept out of the main stats, and one in its semi-finals.
  const tournaments: Tournament[] = []
  const evening = (daysAgo: number, minute: number) => startOfDay(addDays(today, -daysAgo), tz).getTime() + (21 * 60 + minute) * 60_000
  const cupGame = (t: Tournament, home: Player, away: Player, hg: number, ag: number, stage: Stage, at: number, pens: Player | null = null) => {
    seq++
    matches.push({
      id: `demo-match-${seq}`,
      played_at: new Date(at).toISOString(),
      home_id: home.id,
      away_id: away.id,
      home_goals: hg,
      away_goals: ag,
      pens_winner_id: pens?.id ?? null,
      home_team: null,
      away_team: null,
      notes: null,
      screenshot_path: null,
      thumb_path: null,
      submitted_by: home.id,
      status: 'ok',
      dispute_reason: null,
      disputed_by: null,
      created_at: new Date(at + 5 * 60_000).toISOString(),
      tournament_id: t.id,
      stage,
      in_stats: t.counts_in_stats,
    })
  }
  const [hari, sam, alex, jay, leo, nik] = players
  const friendly: Tournament = {
    id: 'demo-cup-1',
    name: 'Summer Friendly',
    league_rounds: 1,
    knockout_size: 2,
    counts_in_stats: false,
    created_by: sam.id,
    created_at: new Date(evening(25, 0)).toISOString(),
    players: [sam.id, leo.id, nik.id],
  }
  tournaments.push(friendly)
  cupGame(friendly, sam, leo, 3, 1, 'league', evening(24, 0))
  cupGame(friendly, leo, nik, 0, 2, 'league', evening(24, 40))
  cupGame(friendly, nik, sam, 1, 1, 'league', evening(23, 0))
  cupGame(friendly, sam, nik, 2, 2, 'final', evening(22, 0), nik)
  const october: Tournament = {
    id: 'demo-cup-2',
    name: 'October Cup',
    league_rounds: 1,
    knockout_size: 4,
    counts_in_stats: true,
    created_by: hari.id,
    created_at: new Date(evening(7, 0)).toISOString(),
    players: [hari.id, sam.id, jay.id, alex.id],
  }
  tournaments.push(october)
  cupGame(october, hari, sam, 2, 1, 'league', evening(6, 0))
  cupGame(october, jay, alex, 1, 1, 'league', evening(6, 40))
  cupGame(october, hari, jay, 3, 0, 'league', evening(5, 0))
  cupGame(october, sam, alex, 2, 0, 'league', evening(5, 40))
  cupGame(october, alex, hari, 1, 1, 'league', evening(4, 0))
  cupGame(october, jay, sam, 2, 1, 'league', evening(4, 40))
  cupGame(october, hari, alex, 2, 0, 'sf', evening(2, 0))

  // Most results come with stats, as if read from the full-time screenshot. A separate random
  // sequence keeps the results themselves the same as before stats existed.
  const statRand = mulberry32(5150)
  const byId = new Map(players.map((p) => [p.id, p]))
  for (const m of matches) {
    if (statRand() < 0.75) {
      m.details = { stats: demoStats(statRand, m.home_goals, m.away_goals, skill(byId.get(m.home_id)!), skill(byId.get(m.away_id)!)) }
    }
  }

  // One recent result is disputed, so the dispute flow is visible in the demo.
  const disputed = [...matches].reverse().find((m) => m.home_goals !== m.away_goals && !m.tournament_id)
  if (disputed) {
    disputed.status = 'disputed'
    disputed.disputed_by = disputed.submitted_by === disputed.home_id ? disputed.away_id : disputed.home_id
    disputed.dispute_reason = `It was ${Math.max(0, disputed.home_goals - 1)}-${disputed.away_goals}, not ${disputed.home_goals}-${disputed.away_goals}.`
  }

  const created = new Date(founded).toISOString()
  const achievements: Achievement[] = PRESETS.map(([slug, name, description, emoji, xp, kind, metric, threshold], i) => ({
    id: `ach-${slug}`,
    slug,
    name,
    description,
    emoji,
    xp,
    kind,
    metric,
    threshold,
    active: true,
    sort_order: (i + 1) * 10,
    created_at: created,
  }))
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString()
  const awards: Award[] = [
    { player_id: players[1].id, achievement_id: 'ach-epic-pull', awarded_at: ago(40), awarded_by: players[0].id, note: null },
    { player_id: players[0].id, achievement_id: 'ach-division-one', awarded_at: ago(200), awarded_by: players[0].id, note: null },
  ]
  const card = demoCardImage()
  const announcements: Announcement[] = [
    { id: 'demo-news-1', player_id: players[0].id, body: 'Squad tournament this Sunday, 8 pm. Winner gets bragging rights for a month 🏆', image_path: null, thumb_path: null, created_at: ago(5) },
    { id: 'demo-news-2', player_id: players[3].id, body: 'New formation: 4-2-1-3 with quick counters. Don’t cry when you concede 😏', image_path: null, thumb_path: null, created_at: ago(26) },
    { id: 'demo-news-3', player_id: players[1].id, body: 'Packed a Big Time AMF on my 4th try 🤯 Who wants to test him tonight?', image_path: card, thumb_path: card, created_at: ago(41) },
    { id: 'demo-news-4', player_id: players[4].id, body: 'Finally made Division 2 in ranked. Division 1 next!', image_path: null, thumb_path: null, created_at: ago(75) },
  ]
  const lines = ['GG 🤝', 'That last-minute goal 🔥', 'Lag was unreal 😤', 'Rematch tomorrow, same time.', 'Keeper was asleep on the second one', 'Lucky deflection, no way that counts 😂']
  const comments: Comment[] = [...matches]
    .sort((x, y) => Date.parse(y.played_at) - Date.parse(x.played_at))
    .slice(0, 4)
    .flatMap((m, i) =>
      [m.away_id, m.home_id, players[(i + 2) % players.length].id].slice(0, 2 + (i % 2)).map((pid, j) => ({
        id: `demo-comment-${m.id}-${j}`,
        match_id: m.id,
        player_id: pid,
        body: lines[(i * 2 + j) % lines.length],
        created_at: new Date(Date.parse(m.created_at) + (j + 1) * 7 * 60_000).toISOString(),
      })),
    )

  return {
    players,
    matches,
    tournaments,
    settings: { ...DEFAULT_SETTINGS },
    achievements,
    awards,
    announcements,
    comments,
    joinRequests: [
      {
        user_id: 'demo-request-1',
        email: 'rohan@example.com',
        name: 'Rohan',
        avatar_url: null,
        created_at: new Date(now.getTime() - 3 * 3600_000).toISOString(),
      },
    ],
  }
}
