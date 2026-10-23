import { Camera, ChevronRight, Copy, Crown, Megaphone, PenLine, Plus, Share2, Trophy, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnnouncementCard, ComposerSheet } from '../components/Announcements'
import { MatchCard } from '../components/MatchCard'
import { AwardsStrip, PotwHero } from '../components/Potw'
import { StandingsTable } from '../components/StandingsTable'
import { useToast } from '../components/Toast'
import { BallLogo, Button, ErrorState, GlowIcon, PageSkeleton, SectionTitle, Wordmark, buttonClass, type Tint } from '../components/ui'
import { formatPoints, groupByWeek, newestFirst, weekResult } from '../lib/stats'
import { useAnnouncements, useAuth, useJoinRequests, useLeague, useNow, useTournaments, type League } from '../lib/queries'
import { addDays, weekKey } from '../lib/time'
import { phaseLabel, tournamentState } from '../lib/tournaments'

function MoreLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 text-sm font-semibold text-accent transition hover:text-cyan">
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}

function InviteCard() {
  const toast = useToast()
  const waiting = useJoinRequests(true)
  const url = window.location.origin
  const count = waiting.data?.length ?? 0

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied. Paste it in your group chat.')
    } catch {
      toast.error(`Copy this link: ${url}`)
    }
  }
  async function share() {
    if (!navigator.share) return copy()
    try {
      await navigator.share({ title: document.title, text: 'Join our eFootball league and log your results here:', url })
    } catch {
      // The person closed the share sheet.
    }
  }

  return (
    <section className="card overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.25),transparent_70%)]" />
      <div className="relative flex items-start gap-4">
        <GlowIcon icon={UserPlus} tint="violet" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight font-bold italic uppercase">Invite your squad</h2>
          <p className="mt-1 text-sm text-ink-2">
            Share the link in your group chat. When friends sign up, they wait for you to approve them on the Admin page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<Share2 className="h-4 w-4" />} onClick={() => void share()}>
              Share link
            </Button>
            <Button icon={<Copy className="h-4 w-4" />} onClick={() => void copy()}>
              Copy link
            </Button>
            {count > 0 && (
              <Link to="/admin" className={buttonClass('gold')}>
                <Users className="h-4 w-4" aria-hidden />
                {count} waiting to join
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function SquadNews({ league }: { league: League }) {
  const news = useAnnouncements()
  const { isMember } = useAuth()
  const [composing, setComposing] = useState(false)
  if (!news.data) return null
  const latest = news.data.slice(0, 3)
  if (!latest.length && !isMember) return null
  return (
    <section>
      <SectionTitle
        title="Squad news"
        action={
          <div className="flex items-center gap-4">
            {isMember && (
              <button onClick={() => setComposing(true)} className="flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-cyan">
                <PenLine className="h-4 w-4" aria-hidden /> Post
              </button>
            )}
            {news.data.length > 0 && <MoreLink to="/news">All news</MoreLink>}
          </div>
        }
      />
      {latest.length ? (
        <div className="space-y-2.5">
          {latest.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} league={league} />
          ))}
        </div>
      ) : (
        <button onClick={() => setComposing(true)} className="card card-hover flex w-full items-center gap-3 p-4 text-left">
          <GlowIcon icon={Megaphone} tint="violet" />
          <div>
            <div className="font-semibold">Share some news</div>
            <div className="text-xs text-muted">New signing? Tournament plans? Post it for the squad.</div>
          </div>
        </button>
      )}
      <ComposerSheet open={composing} onClose={() => setComposing(false)} />
    </section>
  )
}

function WaitingBanner() {
  const waiting = useJoinRequests(true)
  const count = waiting.data?.length ?? 0
  if (!count) return null
  return (
    <Link
      to="/admin"
      className="card card-hover flex items-center gap-3 border-gold/30 bg-[linear-gradient(90deg,rgb(255_207_77/0.12),rgb(255_207_77/0.03))] p-3.5"
    >
      <GlowIcon icon={UserPlus} tint="gold" size="sm" />
      <span className="flex-1 text-sm font-semibold">
        {count} friend{count === 1 ? ' is' : 's are'} waiting to join
      </span>
      <span className="text-sm font-semibold text-gold">Review</span>
      <ChevronRight className="h-4 w-4 text-gold" aria-hidden />
    </Link>
  )
}

const STEPS: { icon: typeof Camera; tint: Tint; title: string; body: string }[] = [
  { icon: Camera, tint: 'cyan', title: 'Play and screenshot', body: 'Grab the full-time screen after every match.' },
  { icon: Plus, tint: 'accent', title: 'Log the result', body: 'Pick your opponent, set the score, attach the screenshot. About 15 seconds.' },
  { icon: Crown, tint: 'gold', title: 'Win the week', body: 'Most points by Sunday midnight is crowned Player of the Week.' },
]

function Welcome({ league }: { league: League }) {
  const { isMember, isAdmin, session } = useAuth()
  const s = league.settings
  return (
    <div className="space-y-6">
      <section className="card overflow-hidden px-6 py-12 text-center sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_50%_0%,rgb(61_255_143/0.16),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-[100%] border border-white/[0.07]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full border border-white/[0.07]" />
        <div className="relative">
          <div className="relative mx-auto h-24 w-24">
            <span aria-hidden className="absolute inset-2 rounded-[1.75rem] bg-accent/40 blur-2xl" />
            <BallLogo className="relative h-24 w-24 animate-float" />
          </div>
          <h1 className="mt-7 text-5xl leading-none sm:text-6xl">
            <Wordmark name={s.group_name} />
          </h1>
          <p className="mx-auto mt-4 max-w-md text-ink-2">Every match, every goal, and one champion each week. Log the first result to kick things off.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={isMember || !session ? '/add' : '/login'} className={buttonClass('primary', 'lg')}>
              <Plus className="h-5 w-5" aria-hidden strokeWidth={2.75} /> Log the first result
            </Link>
            <a href="#how-it-works" className={buttonClass('secondary', 'lg')}>
              How it works
            </a>
          </div>
        </div>
      </section>

      {isAdmin && <InviteCard />}

      <SquadNews league={league} />

      <section id="how-it-works" className="scroll-mt-24">
        <SectionTitle title="How it works" />
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="card card-hover p-5">
              <div className="flex items-center justify-between">
                <GlowIcon icon={step.icon} tint={step.tint} />
                <span className="font-display text-4xl leading-none font-bold text-white/10 italic">{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold italic uppercase">{step.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Points: {formatPoints(s.potw_win)} per win · {formatPoints(s.potw_draw)} per draw · {formatPoints(s.potw_goal)} per goal ·{' '}
          {formatPoints(s.potw_clean_sheet)} per clean sheet · at least {s.potw_min_matches} games a week
        </p>
      </section>
    </div>
  )
}

/** Tournaments still being played, with the next game in each. */
function LiveTournaments({ league }: { league: League }) {
  const { data } = useTournaments()
  const active = useMemo(
    () =>
      (data ?? [])
        .map((t) => ({ t, s: tournamentState(t, league.matches) }))
        .filter((x) => x.s.phase !== 'finished')
        .slice(0, 2),
    [data, league.matches],
  )
  if (!active.length) return null
  return (
    <section>
      <SectionTitle title="Tournaments" action={<MoreLink to="/tournaments">All tournaments</MoreLink>} />
      <div className="grid gap-3 md:grid-cols-2">
        {active.map(({ t, s }) => {
          const next = s.open[0]
          return (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="card card-hover flex items-center gap-3 p-4">
              <GlowIcon icon={Trophy} tint="gold" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-xl leading-tight font-bold uppercase italic">{t.name}</div>
                <div className="truncate text-xs text-muted">
                  {phaseLabel(s.phase)}
                  {next ? ` · next: ${league.nameOf(next.home)} vs ${league.nameOf(next.away)}` : ''}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default function Home() {
  const { league, error, refetch } = useLeague()
  const { isAdmin } = useAuth()
  const now = useNow()

  const view = useMemo(() => {
    if (!league) return null
    const { matches, settings, tz, nameOf } = league
    const current = weekKey(now, tz)
    const previous = addDays(current, -7)
    const byWeek = groupByWeek(matches, tz)
    return {
      week: weekResult(byWeek.get(current) ?? [], settings, current, nameOf),
      lastWeek: weekResult(byWeek.get(previous) ?? [], settings, previous, nameOf),
      latest: newestFirst(matches).slice(0, 6),
    }
  }, [league, now])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!league || !view) return <PageSkeleton />
  if (league.matches.length === 0) return <Welcome league={league} />

  return (
    <div className="space-y-7">
      {isAdmin && <WaitingBanner />}
      <PotwHero league={league} week={view.week} lastWeek={view.lastWeek} now={now} />
      <LiveTournaments league={league} />
      <div className="grid grid-cols-1 gap-7 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
        <div className="min-w-0 space-y-7">
          <section>
            <SectionTitle title="This week's awards" />
            <AwardsStrip league={league} awards={view.week.awards} />
          </section>
          <section>
            <SectionTitle title="This week" action={<MoreLink to="/table">Full table</MoreLink>} />
            {view.week.rows.length ? (
              <StandingsTable
                league={league}
                rows={view.week.rows}
                crownId={view.week.winner?.playerId}
                showQualification
                compact
                limit={5}
              />
            ) : (
              <p className="card p-5 text-sm text-ink-2">Nobody has played this week yet.</p>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-7">
          <SquadNews league={league} />
          <section>
            <SectionTitle title="Latest results" action={<MoreLink to="/matches">All matches</MoreLink>} />
            <div className="space-y-2.5">
              {view.latest.map((m) => (
                <MatchCard key={m.id} match={m} league={league} showDate />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
