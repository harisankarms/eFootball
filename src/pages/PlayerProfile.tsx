import { BrickWall, Camera, ChevronRight, Crown, Flame, Footprints, Gamepad2, Goal, Percent, SearchX, Shield, TrendingUp, Utensils } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AchievementBadge } from '../components/AchievementCard'
import { Avatar } from '../components/Avatar'
import { AvatarEditor } from '../components/AvatarEditor'
import { FormChips } from '../components/FormChips'
import { LevelBadge, XpBar } from '../components/Level'
import { MatchCard } from '../components/MatchCard'
import { BackButton, Badge, EmptyState, ErrorState, PageSkeleton, SectionTitle, StatTile, buttonClass } from '../components/ui'
import { api } from '../lib/backend'
import { useAuth, useLeague, useNow, useProgress } from '../lib/queries'
import { formatPct, involves, newestFirst, pastWeeks, playerSummary, signed, trophyCounts, type Outcome } from '../lib/stats'
import { longDate, weekKey, weekLabel } from '../lib/time'

const streakWords: Record<Outcome, [string, string]> = {
  W: ['win', 'wins'],
  D: ['draw', 'draws'],
  L: ['loss', 'losses'],
}

export default function PlayerProfile() {
  const { id = '' } = useParams()
  const { league, error, refetch } = useLeague()
  const { me, isAdmin } = useAuth()
  const now = useNow()
  const progress = useProgress(league)
  const [editingPhoto, setEditingPhoto] = useState(false)

  const data = useMemo(() => {
    if (!league || !league.byId.has(id)) return null
    const { matches, settings, tz, nameOf } = league
    const weeks = pastWeeks(matches, settings, weekKey(now, tz), nameOf)
    const mine = newestFirst(matches.filter((m) => involves(m, id)))
    return {
      summary: playerSummary(matches, id),
      trophies: trophyCounts(weeks).get(id) ?? { potw: 0, goldenBoots: 0, walls: 0, spoons: 0 },
      potwWeeks: weeks.filter((w) => w.winner?.playerId === id).map((w) => w.weekKey),
      recent: mine.slice(0, 5),
      gallery: mine.filter((m) => m.thumb_path || m.screenshot_path).slice(0, 9),
    }
  }, [league, id, now])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league) return <PageSkeleton />
  const player = league.byId.get(id)
  if (!player || !data) {
    return (
      <EmptyState icon={SearchX} title="Player not found">
        <Link to="/players" className={buttonClass('secondary', 'md', 'mt-4')}>
          All players
        </Link>
      </EmptyState>
    )
  }

  const { summary: s, trophies, potwWeeks } = data
  const streak = s.currentStreak
  const canEditPhoto = me?.id === id || isAdmin
  const statuses = progress?.statusesOf(id) ?? []
  const level = progress?.levelOf(id)
  const recentUnlocks = statuses
    .filter((x) => x.unlocked)
    .sort((a, b) => Date.parse(b.unlockedAt ?? '') - Date.parse(a.unlockedAt ?? ''))
  const trophyChips = [
    { n: trophies.potw, icon: Crown, label: 'Player of the Week', cls: 'border-gold/40 bg-gold/10 text-gold' },
    { n: trophies.goldenBoots, icon: Footprints, label: 'Golden Boot', cls: 'border-line-strong bg-surface-2 text-ink-2' },
    { n: trophies.walls, icon: BrickWall, label: 'The Wall', cls: 'border-line-strong bg-surface-2 text-ink-2' },
    { n: trophies.spoons, icon: Utensils, label: 'Wooden Spoon', cls: 'border-line-strong bg-surface-2 text-muted' },
  ].filter((t) => t.n > 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton fallback="/players" />

      <section className="card relative overflow-hidden p-5">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30"
          style={{ background: `linear-gradient(180deg, ${league.colorOf(id)}, transparent)` }}
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar league={league} id={id} size={88} ring={trophies.potw ? 'gold' : undefined} />
            {canEditPhoto && (
              <button
                onClick={() => setEditingPhoto(true)}
                aria-label="Change photo"
                className="absolute -right-1 -bottom-1 grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,#3dff8f,#22d3ee)] text-accent-ink shadow-[0_6px_18px_-4px_rgb(61_255_143/0.7)] ring-[3px] ring-bg transition hover:scale-105"
              >
                <Camera className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[2.6rem] leading-none font-bold uppercase italic">{player.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {me?.id === id && <Badge tone="accent">You</Badge>}
              {player.is_admin && <Badge>Admin</Badge>}
              {!player.active && <Badge>Inactive</Badge>}
              <span className="text-xs text-muted">Joined {longDate(player.created_at, league.tz)}</span>
            </div>
          </div>
        </div>
        {trophyChips.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {trophyChips.map((t) => (
              <span key={t.label} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${t.cls}`}>
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.n}× {t.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {level && (
        <section className="card overflow-hidden p-4">
          <div aria-hidden className="pointer-events-none absolute -top-14 -right-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.22),transparent_70%)]" />
          <Link to={`/achievements${me?.id === id ? '' : `?player=${id}`}`} className="relative flex items-center gap-3">
            <LevelBadge level={level.level} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-2xl leading-tight font-bold uppercase italic">{level.title}</div>
              <div className="text-xs text-muted">
                Level {level.level} · {level.xp.toLocaleString()} XP · {recentUnlocks.length} of {statuses.length} achievements
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          </Link>
          <div className="relative mt-3">
            <XpBar info={level} compact />
          </div>
          {recentUnlocks.length > 0 && (
            <div className="relative mt-4 flex flex-wrap gap-2">
              {recentUnlocks.slice(0, 8).map((x) => (
                <AchievementBadge key={x.achievement.id} achievement={x.achievement} unlocked size={42} />
              ))}
            </div>
          )}
        </section>
      )}

      {s.played === 0 ? (
        <p className="card p-5 text-sm text-ink-2">No games yet. Stats appear after the first result.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Played" value={s.played} sub={`${s.won}W · ${s.drawn}D · ${s.lost}L`} icon={Gamepad2} tint="cyan" />
            <StatTile label="Win rate" value={formatPct(s.winPct)} sub={`${signed(s.gf - s.ga)} goal difference`} icon={Percent} />
            <StatTile label="Goals" value={s.gf} sub={`${s.goalsPerGame.toFixed(1)} per game`} icon={Goal} tint="gold" />
            <StatTile label="Clean sheets" value={s.cleanSheets} sub={`${s.ga} conceded`} icon={Shield} tint="cyan" />
            <StatTile label="Best win streak" value={s.bestWinStreak} sub={`Longest unbeaten run: ${s.bestUnbeatenRun}`} icon={Flame} tint="gold" />
            <StatTile
              icon={TrendingUp}
              tint="violet"
              label="Current run"
              value={streak ? `${streak.count} ${streakWords[streak.outcome][streak.count === 1 ? 0 : 1]}` : '–'}
              sub="in a row"
            />
          </div>

          <section className="card p-4">
            <div className="mb-3 text-xs font-medium text-muted">Last {s.form.length} games, oldest to newest</div>
            <FormChips form={s.form} size="md" />
          </section>

          {(s.biggestWin || s.heaviestDefeat) && (
            <section>
              <SectionTitle title="Highlights" />
              <div className="grid gap-3 md:grid-cols-2">
                {s.biggestWin && (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-muted">Biggest win</div>
                    <MatchCard match={s.biggestWin} league={league} showDate />
                  </div>
                )}
                {s.heaviestDefeat && (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-muted">Heaviest defeat</div>
                    <MatchCard match={s.heaviestDefeat} league={league} showDate />
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <SectionTitle title="Record against" />
            <div className="card divide-y divide-line/70">
              {s.opponents.map((o) => (
                <Link
                  key={o.opponentId}
                  to={`/h2h?a=${id}&b=${o.opponentId}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50"
                >
                  <Avatar league={league} id={o.opponentId} size={32} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{league.nameOf(o.opponentId)}</span>
                  <span className="text-sm text-ink-2 tabular-nums">
                    {o.won}W {o.drawn}D {o.lost}L
                  </span>
                  <span className="w-14 text-right text-xs text-muted tabular-nums">
                    {o.gf}–{o.ga}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {potwWeeks.length > 0 && (
        <section>
          <SectionTitle title="Player of the Week" />
          <div className="flex flex-wrap gap-2">
            {potwWeeks.map((w) => (
              <Link
                key={w}
                to={`/table?at=${w}`}
                className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.07] px-3 py-1.5 text-xs font-semibold text-gold"
              >
                <Crown className="h-3.5 w-3.5" aria-hidden /> {weekLabel(w)}
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.recent.length > 0 && (
        <section>
          <SectionTitle
            title="Recent matches"
            action={
              <Link to={`/matches?player=${id}`} className="text-sm font-semibold text-accent hover:underline">
                See all
              </Link>
            }
          />
          <div className="space-y-2.5">
            {data.recent.map((m) => (
              <MatchCard key={m.id} match={m} league={league} showDate />
            ))}
          </div>
        </section>
      )}

      {data.gallery.length > 0 && (
        <section>
          <SectionTitle title="Screenshots" />
          <div className="grid grid-cols-3 gap-2">
            {data.gallery.map((m) => (
              <Link key={m.id} to={`/match/${m.id}`} className="overflow-hidden rounded-xl border border-line">
                <img
                  src={api.imageUrl(m.thumb_path ?? m.screenshot_path) ?? ''}
                  alt={`${league.nameOf(m.home_id)} ${m.home_goals}–${m.away_goals} ${league.nameOf(m.away_id)}`}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition hover:scale-105"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {canEditPhoto && (
        <AvatarEditor open={editingPhoto} onClose={() => setEditingPhoto(false)} league={league} player={player} self={me?.id === id} />
      )}
    </div>
  )
}
