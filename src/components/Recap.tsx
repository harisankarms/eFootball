import { BrickWall, Footprints, Medal, Zap } from 'lucide-react'
import { useMemo } from 'react'
import type { League } from '../lib/queries'
import { newsworthy, recordBook } from '../lib/records'
import { formatPerGame, formatPoints, sideOf, winnerOf, type WeekResult } from '../lib/stats'
import { addDays, startOfDay, weekLabel } from '../lib/time'
import { Avatar } from './Avatar'
import { CollectibleCard } from './Potw'
import { RECORD_ICONS, breakSentence } from './Records'
import { AwardSlide, Count, Story, at, type Posters, type Slide } from './Story'
import { StandingsTable } from './StandingsTable'
import { BallLogo, GlowIcon } from './ui'

function buildSlides(league: League, week: WeekResult): Slide[] {
  const { nameOf } = league
  const label = weekLabel(week.weekKey)
  const a = week.awards
  const goals = week.matches.reduce((s, m) => s + m.home_goals + m.away_goals, 0)
  const players = new Set(week.matches.flatMap((m) => [m.home_id, m.away_id])).size
  const slides: Slide[] = []
  const weekShare = { name: `week-in-review-${week.weekKey}`, text: `Week in review: ${label}`, make: (p: Posters) => p.weekPoster(league, week, label) }

  slides.push({
    key: 'intro',
    theme: 'intro',
    share: weekShare,
    body: (
      <>
        <div className="recap-pop" style={at(0)}>
          <BallLogo className="h-20 w-20 animate-float" />
        </div>
        <div className="recap-kicker recap-in" style={at(1)}>
          Week in review
        </div>
        <div className="recap-title recap-in" style={at(2)}>
          {label}
        </div>
        <div className="recap-tiles recap-in" style={at(3)}>
          <div className="recap-tile">
            <strong>
              <Count value={week.matches.length} />
            </strong>
            <span>Games</span>
          </div>
          <div className="recap-tile">
            <strong>
              <Count value={goals} />
            </strong>
            <span>Goals</span>
          </div>
          <div className="recap-tile">
            <strong>
              <Count value={players} />
            </strong>
            <span>Players</span>
          </div>
        </div>
      </>
    ),
  })

  if (week.winner) {
    const w = week.winner
    slides.push({
      key: 'potw',
      theme: 'potw',
      share: {
        name: `player-of-the-week-${week.weekKey}`,
        text: `${nameOf(w.playerId)} is Player of the Week (${label}) 👑`,
        make: (p) => p.cardPoster(league, { kind: 'potw', row: w, caption: label, subtitle: label }),
      },
      body: (
        <>
          <div className="recap-kicker recap-in" style={at(0)}>
            Player of the Week
          </div>
          <div className="recap-card recap-pop" style={at(1)}>
            <CollectibleCard league={league} row={w} caption={label} />
          </div>
          <div className="recap-title recap-in" style={at(2)}>
            {nameOf(w.playerId)}
          </div>
          <div className="recap-sub recap-in" style={at(3)}>
            {formatPoints(w.points)} points · {w.won}W {w.drawn}D {w.lost}L · {w.gf} goals
          </div>
        </>
      ),
    })
  }

  if (a.goldenBoot) {
    const ids = a.goldenBoot.ids
    slides.push({
      key: 'boot',
      theme: 'boot',
      share: {
        name: `golden-boot-${week.weekKey}`,
        text: `Golden Boot (${label}): ${ids.map(nameOf).join(' & ')}, ${a.goldenBoot.goals} goals`,
        make: (p) => p.awardPoster(league, { icon: 'boot', first: 'Golden', rest: 'boot', subtitle: label, ids, detail: `${a.goldenBoot!.goals} goals` }),
      },
      body: (
        <AwardSlide league={league} icon={Footprints} tint="gold" label="Golden Boot" ids={ids} title={ids.map(nameOf).join(' & ')} detail={`${a.goldenBoot.goals} goals`} />
      ),
    })
  }

  if (a.wall) {
    const ids = a.wall.ids
    const n = a.wall.cleanSheets
    const detail = `${n} clean sheet${n === 1 ? '' : 's'}`
    slides.push({
      key: 'wall',
      theme: 'wall',
      share: {
        name: `the-wall-${week.weekKey}`,
        text: `The Wall (${label}): ${ids.map(nameOf).join(' & ')}, ${detail}`,
        make: (p) => p.awardPoster(league, { icon: 'wall', first: 'The', rest: 'wall', subtitle: label, ids, detail }),
      },
      body: <AwardSlide league={league} icon={BrickWall} tint="cyan" label="The Wall" ids={ids} title={ids.map(nameOf).join(' & ')} detail={detail} />,
    })
  }

  const big = a.biggestWin
  const bigWinner = big ? winnerOf(big) : null
  if (big && bigWinner) {
    const s = sideOf(big, bigWinner)
    slides.push({
      key: 'win',
      theme: 'win',
      share: {
        name: `biggest-win-${week.weekKey}`,
        text: `Biggest win (${label}): ${nameOf(bigWinner)} ${s.gf}–${s.ga} ${nameOf(s.opponentId)}`,
        make: (p) => p.matchPoster(league, big),
      },
      body: (
        <>
          <div className="recap-pop" style={at(0)}>
            <GlowIcon icon={Zap} tint="accent" size="lg" />
          </div>
          <div className="recap-kicker recap-in" style={at(1)}>
            Biggest win
          </div>
          <div className="recap-pop flex items-center justify-center gap-4" style={at(2)}>
            <Avatar league={league} id={bigWinner} size={96} ring="gold" />
            <span className="recap-big">
              {s.gf}–{s.ga}
            </span>
            <Avatar league={league} id={s.opponentId} size={96} />
          </div>
          <div className="recap-title recap-in" style={at(3)}>
            {nameOf(bigWinner)}
          </div>
          <div className="recap-sub recap-in" style={at(4)}>
            against {nameOf(s.opponentId)}
          </div>
        </>
      ),
    })
  }

  if (a.chenda) {
    const c = a.chenda
    slides.push({
      key: 'chenda',
      theme: 'chenda',
      share: {
        name: `chenda-${week.weekKey}`,
        text: `${nameOf(c.playerId)} got the chenda (${label}) 🥁`,
        make: (p) => p.cardPoster(league, { kind: 'chenda', row: c, caption: label, subtitle: label }),
      },
      body: (
        <>
          <div className="recap-kicker recap-in" style={at(0)}>
            And on the chenda…
          </div>
          <div className="recap-card recap-pop" style={at(1)}>
            <CollectibleCard kind="chenda" league={league} row={c} caption={label} />
          </div>
          <div className="recap-title recap-in" style={at(2)}>
            {nameOf(c.playerId)}
          </div>
          <div className="recap-sub recap-in" style={at(3)}>
            {formatPerGame(c)} points a game · {c.won}W {c.drawn}D {c.lost}L
          </div>
        </>
      ),
    })
  }

  // Records that fell during the week (weekly ones fall the moment it ends).
  const from = startOfDay(week.weekKey, league.tz).getTime()
  const to = startOfDay(addDays(week.weekKey, 7), league.tz).getTime()
  const broken = newsworthy(recordBook(league.matches, league.settings, addDays(week.weekKey, 7))).filter((b) => {
    const t = Date.parse(b.mark.at)
    return t >= from && t <= to
  })
  if (broken.length) {
    slides.push({
      key: 'records',
      theme: 'records',
      share: weekShare,
      body: (
        <>
          <div className="recap-pop" style={at(0)}>
            <GlowIcon icon={Medal} tint="violet" size="lg" />
          </div>
          <div className="recap-title recap-in" style={at(1)}>
            {broken.length === 1 ? 'A record fell' : `${broken.length} records fell`}
          </div>
          <div className="recap-list">
            {broken.slice(0, 4).map((b, i) => {
              const { icon, tint } = RECORD_ICONS[b.key]
              return (
                <div key={`${b.key}${b.mark.at}`} className="recap-row recap-in" style={at(i + 2)}>
                  <GlowIcon icon={icon} tint={tint} size="sm" />
                  <span className="text-sm leading-snug">{breakSentence(league, b)}</span>
                </div>
              )
            })}
          </div>
        </>
      ),
    })
  }

  slides.push({
    key: 'table',
    theme: 'table',
    share: {
      name: `table-${week.weekKey}`,
      text: `Final table, ${label}`,
      make: (p) =>
        p.tablePoster(league, { rows: week.rows, first: 'Final', rest: 'table', subtitle: label, crownId: week.winner?.playerId, drumId: a.chenda?.playerId }),
    },
    body: (
      <>
        <div className="recap-kicker recap-in" style={at(0)}>
          Final table
        </div>
        <div className="recap-title recap-in" style={at(1)}>
          {label}
        </div>
        <div className="recap-in pointer-events-none w-full text-left" style={at(2)}>
          <StandingsTable
            league={league}
            rows={week.rows}
            crownId={week.winner?.playerId}
            drumId={a.chenda?.playerId}
            showQualification
            compact
            limit={6}
          />
        </div>
      </>
    ),
  })

  slides.push({
    key: 'outro',
    theme: 'outro',
    share: weekShare,
    body: (
      <>
        <div className="recap-pop" style={at(0)}>
          <BallLogo className="h-20 w-20" />
        </div>
        <div className="recap-title recap-in" style={at(1)}>
          That's the week
        </div>
        <div className="recap-sub recap-in" style={at(2)}>
          A new race for Player of the Week is on. Share the week with the group, or get back on the pitch.
        </div>
      </>
    ),
  })
  return slides
}

/** Last week as a story. */
export function Recap({ league, week, onClose }: { league: League; week: WeekResult; onClose: () => void }) {
  const slides = useMemo(() => buildSlides(league, week), [league, week])
  return <Story slides={slides} title={`Week in review, ${weekLabel(week.weekKey)}`} onClose={onClose} />
}
