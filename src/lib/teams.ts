import { similarity } from './matchStats'

/** Teams suggested in the team fields of the result form. */
export const POPULAR_TEAMS = [
  'Dream Team',
  'Real Madrid',
  'FC Barcelona',
  'Manchester City',
  'Manchester United',
  'Liverpool',
  'Arsenal',
  'Chelsea',
  'Bayern München',
  'Paris Saint-Germain',
  'Inter',
  'AC Milan',
  'Juventus',
  'Argentina',
  'Brazil',
  'France',
  'England',
  'Portugal',
  'Spain',
  'Germany',
]

/**
 * Clubs and countries as eFootball names them. When someone plays with one of these instead
 * of their Dream Team, the full-time screen shows the club's name where the player's own
 * team name would be.
 */
const CLUBS = [
  'FC Barcelona',
  'Real Madrid CF',
  'Atlético de Madrid',
  'Manchester United FC',
  'Manchester City',
  'Liverpool FC',
  'Arsenal',
  'Chelsea FC',
  'Tottenham Hotspur',
  'Newcastle United',
  'Aston Villa',
  'FC Bayern München',
  'Borussia Dortmund',
  'Bayer 04 Leverkusen',
  'RB Leipzig',
  'Paris Saint-Germain',
  'Olympique de Marseille',
  'Olympique Lyonnais',
  'AS Monaco',
  'Inter',
  'AC Milan',
  'Juventus',
  'SSC Napoli',
  'AS Roma',
  'SS Lazio',
  'Atalanta',
  'AFC Ajax',
  'PSV Eindhoven',
  'Feyenoord',
  'SL Benfica',
  'FC Porto',
  'Sporting CP',
  'Celtic FC',
  'Galatasaray',
  'Fenerbahçe',
  'Al Nassr',
  'Al Hilal',
  'Al Ittihad',
  'Inter Miami CF',
  'Flamengo',
  'Boca Juniors',
  'River Plate',
  'Argentina',
  'Brazil',
  'France',
  'England',
  'Portugal',
  'Spain',
  'Germany',
  'Italy',
  'Netherlands',
  'Belgium',
  'Croatia',
  'Uruguay',
  'Japan',
  'Morocco',
  'USA',
  'Mexico',
  'India',
]

const simple = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/**
 * The club or country a name read from a screenshot stands for, spelled properly, or null
 * when it looks like a player's own team name. Tolerates OCR slips such as "IFC Barcelona".
 */
export function clubName(name: string): string | null {
  const n = simple(name)
  if (n.length < 3) return null
  let best: string | null = null
  let bestScore = 0.85
  for (const club of CLUBS) {
    const c = simple(club)
    const score = c.length >= 7 && n.includes(c) ? 0.95 : similarity(n, c)
    if (score > bestScore) {
      best = club
      bestScore = score
    }
  }
  return best
}
