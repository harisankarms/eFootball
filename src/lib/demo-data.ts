// Sample squad and six weeks of results so the site can be explored before a
// database is connected. Seeded, so the demo looks the same on every load.
import { addDays, dayKey, startOfDay } from './time'
import { DEFAULT_SETTINGS, type JoinRequest, type Match, type Player, type Settings } from './types'

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

export type DemoDb = {
  players: Player[]
  matches: Match[]
  settings: Settings
  joinRequests: JoinRequest[]
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

  // One recent result is disputed, so the dispute flow is visible in the demo.
  const disputed = [...matches].reverse().find((m) => m.home_goals !== m.away_goals)
  if (disputed) {
    disputed.status = 'disputed'
    disputed.disputed_by = disputed.submitted_by === disputed.home_id ? disputed.away_id : disputed.home_id
    disputed.dispute_reason = `It was ${Math.max(0, disputed.home_goals - 1)}-${disputed.away_goals}, not ${disputed.home_goals}-${disputed.away_goals}.`
  }

  return {
    players,
    matches,
    settings: { ...DEFAULT_SETTINGS },
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
