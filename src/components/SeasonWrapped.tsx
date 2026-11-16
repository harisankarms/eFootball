import { BrickWall, CalendarDays, Crown, Footprints } from 'lucide-react'
import { useMemo } from 'react'
import type { League } from '../lib/queries'
import { overallRating, ratings } from '../lib/rating'
import { seasonName, seasonSpan, type SeasonKey, type SeasonResult } from '../lib/seasons'
import { buildTable, formatPerGame, formatPoints } from '../lib/stats'
import { Walkout } from './Walkout'
import { CollectibleCard } from './Potw'
import { AwardSlide, Count, Story, at, type Posters, type Slide } from './Story'
import { StandingsTable } from './StandingsTable'
import { BallLogo } from './ui'

const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? null

function buildSeasonSlides(league: League, season: SeasonResult, first: SeasonKey, live: boolean): Slide[] {
  const { nameOf } = league
  const name = seasonName(season.key, first)
  const span = seasonSpan(season.key)
  const a = season.awards
  const goals = season.matches.reduce((s, m) => s + m.home_goals + m.away_goals, 0)
  const players = new Set(season.matches.flatMap((m) => [m.home_id, m.away_id])).size
  const slides: Slide[] = []
  const seasonShare = {
    name: `season-review-${season.key}`,
    text: `${name} (${span}) in review`,
    make: (p: Posters) => p.weekPoster(league, { matches: season.matches, winner: season.champion, awards: a }, `${name} · ${span}`, 'season'),
  }

  slides.push({
    key: 'intro',
    theme: 'boot',
    share: seasonShare,
    body: (
      <>
        <div className="recap-pop" style={at(0)}>
          <BallLogo className="h-20 w-20 animate-float" />
        </div>
        <div className="recap-kicker recap-in" style={at(1)}>
          {live ? 'The season so far' : 'Season review'}
        </div>
        <div className="recap-title recap-in" style={at(2)}>
          {name}
        </div>
        <div className="recap-sub recap-in" style={at(3)}>
          {span}
        </div>
        <div className="recap-tiles recap-in" style={at(4)}>
          <div className="recap-tile">
            <strong>
              <Count value={season.matches.length} />
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

  const champ = season.champion
  if (champ) {
    const career = buildTable(league.matches, league.settings, 0, nameOf).find((r) => r.playerId === champ.playerId) ?? champ
    const ovr = overallRating(ratings(league.matches).current.get(champ.playerId) ?? 1000)
    slides.push({
      key: 'champion',
      theme: 'boot',
      ms: 18_000,
      share: {
        name: `season-champion-${season.key}`,
        text: `${nameOf(champ.playerId)} ${live ? 'leads' : 'wins'} ${name} 🏆`,
        make: (p) =>
          p.cardPoster(league, {
            kind: 'player',
            row: career,
            overall: ovr,
            caption: `${name} ${live ? 'leader' : 'champion'}`,
            subtitle: span,
            title: ['Season', live ? 'leader' : 'champion'],
            line: `${formatPoints(champ.points)} pts · ${champ.won}W ${champ.drawn}D ${champ.lost}L · ${champ.gf} goals`,
          }),
      },
      body: (
        <Walkout
          league={league}
          row={champ}
          rating={ovr}
          banner={live ? 'Season leader' : 'Season champion'}
          clues={[span.split(' ')[0], name]}
          line={`${name} · ${formatPoints(champ.points)} points · ${champ.won}W ${champ.drawn}D ${champ.lost}L`}
          card={<CollectibleCard kind="player" league={league} row={career} overall={ovr} caption={`${name} ${live ? 'leader' : 'champion'}`} />}
        />
      ),
    })
  }

  const honour = (key: string, theme: string, slide: Omit<Slide, 'key' | 'theme'>) => slides.push({ key, theme, ...slide })
  if (a.goldenBoot) {
    const ids = a.goldenBoot.ids
    const detail = `${a.goldenBoot.goals} goals`
    honour('boot', 'boot', {
      share: { name: `season-top-scorer-${season.key}`, text: `${name} top scorer: ${ids.map(nameOf).join(' & ')}, ${detail}`, make: (p) => p.awardPoster(league, { icon: 'boot', first: 'Top', rest: 'scorer', subtitle: `${name} · ${span}`, ids, detail }) },
      body: <AwardSlide league={league} icon={Footprints} tint="gold" label="Top scorer of the season" ids={ids} title={ids.map(nameOf).join(' & ')} detail={detail} />,
    })
  }
  if (a.wall) {
    const ids = a.wall.ids
    const detail = `${a.wall.cleanSheets} clean sheets`
    honour('wall', 'wall', {
      share: { name: `season-best-defence-${season.key}`, text: `${name} best defence: ${ids.map(nameOf).join(' & ')}, ${detail}`, make: (p) => p.awardPoster(league, { icon: 'wall', first: 'Best', rest: 'defence', subtitle: `${name} · ${span}`, ids, detail }) },
      body: <AwardSlide league={league} icon={BrickWall} tint="cyan" label="Best defence" ids={ids} title={ids.map(nameOf).join(' & ')} detail={detail} />,
    })
  }
  const crowns = top(season.crowns)
  if (crowns) {
    const detail = `${crowns[1]}× Player of the Week`
    honour('crowns', 'potw', {
      share: { name: `season-crowns-${season.key}`, text: `${name}: ${nameOf(crowns[0])}, ${detail}`, make: (p) => p.awardPoster(league, { icon: 'trophy', first: 'Most', rest: 'crowns', subtitle: `${name} · ${span}`, ids: [crowns[0]], detail }) },
      body: <AwardSlide league={league} icon={Crown} tint="gold" label="Most weekly crowns" ids={[crowns[0]]} title={nameOf(crowns[0])} detail={detail} />,
    })
  }
  const months = top(season.months)
  if (months) {
    const detail = `${months[1]}× Player of the Month`
    honour('months', 'potm', {
      share: { name: `season-months-${season.key}`, text: `${name}: ${nameOf(months[0])}, ${detail}`, make: (p) => p.awardPoster(league, { icon: 'trophy', first: 'Month', rest: 'after month', subtitle: `${name} · ${span}`, ids: [months[0]], detail }) },
      body: <AwardSlide league={league} icon={CalendarDays} tint="ember" label="Player of the Month titles" ids={[months[0]]} title={nameOf(months[0])} detail={detail} />,
    })
  }
  if (a.chenda) {
    const c = a.chenda
    honour('chenda', 'chenda', {
      share: { name: `season-chenda-${season.key}`, text: `${nameOf(c.playerId)} is the chenda of ${name} 🥁`, make: (p) => p.cardPoster(league, { kind: 'chenda', row: c, caption: name, subtitle: `${name} · ${span}`, title: ['Chenda', 'of the season'] }) },
      body: (
        <>
          <div className="recap-kicker recap-in" style={at(0)}>
            Chenda of the season
          </div>
          <div className="recap-card recap-pop" style={at(1)}>
            <CollectibleCard kind="chenda" league={league} row={c} caption={name} />
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

  slides.push({
    key: 'table',
    theme: 'table',
    share: {
      name: `season-table-${season.key}`,
      text: `${name} table`,
      make: (p) => p.tablePoster(league, { rows: season.rows, first: 'Season', rest: 'table', subtitle: `${name} · ${span}`, crownId: champ?.playerId, drumId: a.chenda?.playerId }),
    },
    body: (
      <>
        <div className="recap-kicker recap-in" style={at(0)}>
          {live ? 'The table so far' : 'Final table'}
        </div>
        <div className="recap-title recap-in" style={at(1)}>
          {name}
        </div>
        <div className="recap-in pointer-events-none w-full text-left" style={at(2)}>
          <StandingsTable league={league} rows={season.rows} crownId={champ?.playerId} drumId={a.chenda?.playerId} showQualification compact limit={6} />
        </div>
      </>
    ),
  })

  slides.push({
    key: 'outro',
    theme: 'outro',
    share: seasonShare,
    body: (
      <>
        <div className="recap-pop" style={at(0)}>
          <BallLogo className="h-20 w-20" />
        </div>
        <div className="recap-title recap-in" style={at(1)}>
          {live ? 'Still all to play for' : `That's ${name}`}
        </div>
        <div className="recap-sub recap-in" style={at(2)}>
          {live ? 'The season runs to the end of ' + span.split(' ')[0].split('–')[1] + '. Every game counts.' : 'A new season starts now, with a clean table.'}
        </div>
      </>
    ),
  })
  return slides
}

/** A season as a story, with its champion's card revealed. `live` for the season still being played. */
export function SeasonWrapped({ league, season, first, live = false, onClose }: { league: League; season: SeasonResult; first: SeasonKey; live?: boolean; onClose: () => void }) {
  const slides = useMemo(() => buildSeasonSlides(league, season, first, live), [league, season, first, live])
  return <Story slides={slides} title={`${live ? 'Season so far' : 'Season review'}, ${seasonName(season.key, first)}`} onClose={onClose} />
}
