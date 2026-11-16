// Where each challenge stands, worked out from the challenge and the results, so nothing has to
// be marked "played" by hand: an accepted challenge is settled by the next result between the two.
import { chronological, involves, isCounted } from './stats'
import type { Challenge, Match } from './types'

/** An open challenge nobody answers lapses after a week. */
export const CHALLENGE_DAYS = 7

export type ChallengeState =
  | { kind: 'waiting' }
  | { kind: 'expired' }
  | { kind: 'game-on' }
  | { kind: 'played'; match: Match }
  | { kind: 'declined' }
  | { kind: 'cancelled' }

export function challengeState(c: Challenge, matches: Match[], now: Date): ChallengeState {
  if (c.status === 'declined') return { kind: 'declined' }
  if (c.status === 'cancelled') return { kind: 'cancelled' }
  if (c.status === 'open') {
    return now.getTime() - Date.parse(c.created_at) > CHALLENGE_DAYS * 86_400_000 ? { kind: 'expired' } : { kind: 'waiting' }
  }
  const since = Date.parse(c.responded_at ?? c.created_at)
  const match = chronological(matches).find(
    (m) => isCounted(m) && involves(m, c.from_id) && involves(m, c.to_id) && Date.parse(m.played_at) >= since,
  )
  return match ? { kind: 'played', match } : { kind: 'game-on' }
}

/** The challenges worth showing now: everything still live, and anything settled in the last few days. */
export function liveChallenges(challenges: Challenge[], matches: Match[], now: Date, recentDays = 3) {
  return challenges
    .map((c) => ({ challenge: c, state: challengeState(c, matches, now) }))
    .filter(({ challenge, state }) => {
      if (state.kind === 'waiting' || state.kind === 'game-on') return true
      const at = state.kind === 'played' ? Date.parse(state.match.played_at) : Date.parse(challenge.responded_at ?? challenge.created_at)
      return state.kind !== 'expired' && state.kind !== 'cancelled' && now.getTime() - at < recentDays * 86_400_000
    })
}
