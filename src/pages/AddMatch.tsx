import { useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { ArrowLeftRight, Check, ChevronDown, CircleAlert, CircleCheck, Gamepad2, ImagePlus, LoaderCircle, Minus, Plus, SearchX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { SignInPrompt, WaitingForApproval } from '../components/Guards'
import { useToast } from '../components/Toast'
import { Badge, Button, EmptyState, ErrorState, PageSkeleton, PageTitle, Toggle, buttonClass } from '../components/ui'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { compressScreenshot, formatBytes } from '../lib/image'
import { unlocksFrom } from '../lib/achievements'
import { gameNameOwner, type MatchStats } from '../lib/matchStats'
import { keys, useAchievements, useAuth, useAwards, useLeague, type League } from '../lib/queries'
import { ReaderUnavailableError, readResultScreenshot, type ScreenshotReading } from '../lib/readResult'
import { pastWeeks, winnerOf } from '../lib/stats'
import { POPULAR_TEAMS, clubName } from '../lib/teams'
import { toLocalInputValue, weekKey } from '../lib/time'
import type { Match, MatchInput, Player, Shot } from '../lib/types'

type ReadState = {
  status: 'reading' | 'done' | 'failed'
  result: ScreenshotReading | null
  /** Why reading failed: the picture isn't a full-time stats screen, the reader couldn't load, or something broke. */
  reason?: 'not-a-result' | 'unavailable' | 'error'
  /** The technical reason, shown small so it can be passed on when something goes wrong. */
  detail?: string
}

/** Club and country names are spelled properly, since OCR sometimes misreads their lettering. */
function tidy(r: ScreenshotReading): ScreenshotReading {
  const fix = (name: string | null) => (name ? (clubName(name) ?? name) : null)
  return { ...r, homeName: fix(r.homeName), awayName: fix(r.awayName) }
}

/** The same reading seen from the other side, for when the sides are swapped. */
function flipped(r: ScreenshotReading): ScreenshotReading {
  const stats: MatchStats = {}
  for (const [key, pair] of Object.entries(r.stats) as [keyof MatchStats, [number, number] | undefined][]) {
    if (pair) stats[key] = [pair[1], pair[0]]
  }
  return { homeName: r.awayName, awayName: r.homeName, homeGoals: r.awayGoals, awayGoals: r.homeGoals, stats }
}

function ReadNote({ read, onRetry }: { read: ReadState; onRetry: () => void }) {
  const r = read.result
  if (read.status === 'failed' && read.reason !== 'not-a-result') {
    return (
      <div className="flex items-start gap-2 text-xs text-muted">
        <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          {read.reason === 'unavailable'
            ? "Couldn't load the screenshot reader. Check your connection and try again, or fill the result in below."
            : 'Something went wrong while reading this screenshot. Try again, or fill the result in below.'}
          <button type="button" onClick={onRetry} className="ml-1.5 font-semibold text-accent hover:underline">
            Try again
          </button>
          {read.detail && <span className="mt-1 block break-words text-[11px] text-muted/70">{read.detail}</span>}
        </div>
      </div>
    )
  }
  if (read.status === 'failed') {
    return (
      <p className="flex items-start gap-2 text-xs text-muted">
        <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        Couldn't find a result in this picture. It works with the full-time stats screen, the one with the score and the stats
        table. Fill the result in below.
      </p>
    )
  }
  if (read.status === 'reading' || !r) {
    return (
      <p className="flex items-start gap-2 text-xs text-ink-2">
        <LoaderCircle className="mt-px h-3.5 w-3.5 shrink-0 animate-spin text-accent" aria-hidden />
        {r ? `Read the score: ${r.homeGoals}–${r.awayGoals}. Now reading the match stats…` : 'Reading the result from the screenshot…'}
      </p>
    )
  }
  const stats = Object.keys(r.stats).length
  return (
    <p className="flex items-start gap-2 text-xs text-ink-2">
      <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      Filled in from the screenshot: {r.homeGoals}–{r.awayGoals}
      {stats ? ` and ${stats} match stat${stats === 1 ? '' : 's'}` : ''}. Check it before saving.
    </p>
  )
}

function celebrate() {
  const shared = { particleCount: 80, spread: 65, startVelocity: 48, colors: ['#3dff8f', '#ffc94d', '#ffffff'], disableForReducedMotion: true }
  void confetti({ ...shared, angle: 60, origin: { x: 0.1, y: 0.85 } })
  void confetti({ ...shared, angle: 120, origin: { x: 0.9, y: 0.85 } })
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const btn = 'grid h-11 w-11 place-items-center rounded-full border transition active:scale-90 disabled:opacity-30'
  return (
    <div className="flex flex-col items-center gap-3" role="group" aria-label={label}>
      <output aria-live="polite" className="text-6xl leading-none font-bold tabular-nums">
        {value}
      </output>
      <div className="flex gap-2.5">
        <button
          type="button"
          aria-label={`${label}: one less`}
          disabled={value === 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className={`${btn} border-line-strong bg-surface-2 text-ink-2`}
        >
          <Minus className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={`${label}: one more`}
          disabled={value >= 99}
          onClick={() => onChange(Math.min(99, value + 1))}
          className={`${btn} border-accent/30 bg-accent/12 text-accent`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function Slot({
  league,
  id,
  label,
  isMe,
  active,
  gameName,
  onClick,
}: {
  league: League
  id: string
  label: string
  isMe: boolean
  active: boolean
  /** The name shown in the game for this side, when it was read from the screenshot. */
  gameName?: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition ${
        active ? 'border-accent bg-accent/[0.07]' : 'border-line bg-surface-2/50 hover:border-line-strong'
      }`}
    >
      {id ? (
        <Avatar league={league} id={id} size={56} />
      ) : (
        <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-line-strong text-muted">
          <Plus className="h-6 w-6" aria-hidden />
        </span>
      )}
      <span className="max-w-full truncate font-semibold">{id ? league.nameOf(id) : 'Pick player'}</span>
      <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">
        {label}
        {isMe ? ' · you' : ''}
      </span>
      {gameName && (
        <span className="flex max-w-full items-center gap-1 text-[11px] text-ink-2">
          <Gamepad2 className="h-3 w-3 shrink-0 text-muted" aria-hidden />
          <span className="sr-only">In-game name:</span>
          <span className="truncate">{gameName}</span>
        </span>
      )}
    </button>
  )
}

function MatchForm({ league, me, existing }: { league: League; me: Player; existing: Match | null }) {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const { nameOf, settings } = league
  const achievements = useAchievements()
  const awards = useAwards()

  const [homeId, setHomeId] = useState(existing?.home_id ?? me.id)
  const [awayId, setAwayId] = useState(existing?.away_id ?? '')
  const [picking, setPicking] = useState<'home' | 'away' | null>(existing ? null : 'away')
  const [hg, setHg] = useState(existing?.home_goals ?? 0)
  const [ag, setAg] = useState(existing?.away_goals ?? 0)
  const [pensOn, setPensOn] = useState(!!existing?.pens_winner_id)
  const [pensWinner, setPensWinner] = useState<string | null>(existing?.pens_winner_id ?? null)
  const [shot, setShot] = useState<{ data: Shot; preview: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [playedAt, setPlayedAt] = useState(() => toLocalInputValue(existing ? new Date(existing.played_at) : new Date()))
  const [homeTeam, setHomeTeam] = useState(existing?.home_team ?? '')
  const [awayTeam, setAwayTeam] = useState(existing?.away_team ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [more, setMore] = useState(!!existing)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [read, setRead] = useState<ReadState | null>(null)
  const [askWho, setAskWho] = useState(false)
  const readRun = useRef(0)
  const readFile = useRef<File | null>(null)
  const gameNames = read?.result

  const selectable = league.players.filter((p) => p.active)
  const draw = hg === ag
  const existingShot = existing ? api.imageUrl(existing.screenshot_path) : null
  const teams = useMemo(() => {
    const used = league.matches.flatMap((m) => [m.home_team, m.away_team]).filter((t): t is string => !!t)
    return [...new Set([...used, ...POPULAR_TEAMS])]
  }, [league.matches])

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.preview)
  }, [shot])

  /** Fills the score and, where the in-game names are known, the players. */
  function fillFrom(r: ScreenshotReading) {
    setHg(r.homeGoals)
    setAg(r.awayGoals)
    // A club or country name says which team was used, not who played it.
    const homeClub = r.homeName ? clubName(r.homeName) : null
    const awayClub = r.awayName ? clubName(r.awayName) : null
    if (homeClub) setHomeTeam(homeClub)
    if (awayClub) setAwayTeam(awayClub)
    let home = r.homeName && !homeClub ? gameNameOwner(r.homeName, league.matches, league.players) : null
    let away = r.awayName && !awayClub ? gameNameOwner(r.awayName, league.matches, league.players) : null
    if (home && home === away) return
    if (!home && !away) {
      setAskWho(!!(r.homeName && r.awayName))
      return
    }
    // Usually the person logging the result played in it.
    if (home && !away && home !== me.id) away = me.id
    if (away && !home && away !== me.id) home = me.id
    setHomeId(home ?? '')
    setAwayId(away ?? '')
    setPicking(!home ? 'home' : !away ? 'away' : null)
    setPensWinner(null)
    setAskWho(false)
  }

  async function readShot(file: File) {
    const run = ++readRun.current
    const current = () => run === readRun.current
    readFile.current = file
    setRead({ status: 'reading', result: null })
    setAskWho(false)
    try {
      const result = await readResultScreenshot(file, (early) => {
        if (!current()) return
        fillFrom(tidy(early))
        setRead({ status: 'reading', result: tidy(early) })
      })
      if (current()) setRead(result ? { status: 'done', result: tidy(result) } : { status: 'failed', result: null, reason: 'not-a-result' })
    } catch (e) {
      console.warn('Screenshot reader:', e)
      if (current()) {
        setRead({
          status: 'failed',
          result: null,
          reason: e instanceof ReaderUnavailableError ? 'unavailable' : 'error',
          detail: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  function iAm(side: 'home' | 'away' | null) {
    setHomeId(side === 'home' ? me.id : '')
    setAwayId(side === 'away' ? me.id : '')
    setPicking(side === 'home' ? 'away' : 'home')
    setPensWinner(null)
    setAskWho(false)
  }

  async function takeFile(file: File) {
    setProcessing(true)
    setFormError(null)
    void readShot(file)
    try {
      const data = await compressScreenshot(file)
      setShot({ data, preview: URL.createObjectURL(data.full) })
    } catch (e) {
      setFormError(friendlyError(e))
    } finally {
      setProcessing(false)
    }
  }

  // Desktop convenience: paste a copied screenshot straight into the form.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) void takeFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void takeFile(file)
  }

  function pick(id: string) {
    if (picking === 'home') {
      setHomeId(id)
      setPicking(awayId ? null : 'away')
    } else {
      setAwayId(id)
      setPicking(homeId ? null : 'home')
    }
    setPensWinner(null)
    setAskWho(false)
  }

  function swap() {
    setHomeId(awayId)
    setAwayId(homeId)
    setHg(ag)
    setAg(hg)
    setHomeTeam(awayTeam)
    setAwayTeam(homeTeam)
    setRead((r) => (r?.result ? { ...r, result: flipped(r.result) } : r))
    setAskWho(false)
  }

  async function submit() {
    setFormError(null)
    if (!homeId || !awayId) return setFormError('Pick both players.')
    if (homeId === awayId) return setFormError('Pick two different players.')
    if (draw && pensOn && !pensWinner) return setFormError('Who won the penalty shootout?')
    if (!existing && settings.require_screenshot && !shot) return setFormError('Add the full-time screenshot as proof.')
    const when = new Date(playedAt)
    if (Number.isNaN(when.getTime())) return setFormError('Pick a valid date and time.')
    if (when.getTime() > Date.now() + 5 * 60_000) return setFormError('That date is in the future.')

    const r = read?.result
    const input: MatchInput = {
      played_at: when.toISOString(),
      home_id: homeId,
      away_id: awayId,
      home_goals: hg,
      away_goals: ag,
      pens_winner_id: draw && pensOn ? pensWinner : null,
      home_team: homeTeam.trim() || null,
      away_team: awayTeam.trim() || null,
      notes: notes.trim() || null,
      details: r
        ? { names: [r.homeName, r.awayName], ...(Object.keys(r.stats).length ? { stats: r.stats } : {}) }
        : shot
          ? null
          : (existing?.details ?? null),
    }

    setSaving(true)
    try {
      if (existing) {
        await api.updateMatch(existing, input, shot?.data ?? null)
        await qc.invalidateQueries({ queryKey: keys.matches })
        toast.success('Result updated')
        navigate(`/match/${existing.id}`, { replace: true })
      } else {
        const matchesBefore = league.matches
        const created = await api.addMatch(input, shot?.data ?? null, me.id)
        await qc.invalidateQueries({ queryKey: keys.matches })
        const winner = winnerOf(created)
        if (winner) celebrate()
        toast.success(winner ? `${nameOf(winner)} takes the win!` : 'Draw saved')
        if (achievements.data && awards.data && (created.home_id === me.id || created.away_id === me.id || created.submitted_by === me.id)) {
          const weeks = pastWeeks(matchesBefore, settings, weekKey(new Date(), league.tz), nameOf)
          const { unlocked, levelUp } = unlocksFrom(achievements.data, awards.data, matchesBefore, created, me.id, weeks, league.tz)
          for (const a of unlocked.slice(0, 2)) toast.success(`${a.emoji} Achievement unlocked: ${a.name} · +${a.xp} XP`)
          if (levelUp) toast.success(`⬆️ Level ${levelUp.level}! You're now ${levelUp.title}`)
          if ((unlocked.length || levelUp) && !winner) celebrate()
        }
        navigate(`/match/${created.id}`, { replace: true })
      }
    } catch (e) {
      setFormError(friendlyError(e))
      setSaving(false)
    }
  }

  const label = (id: string, fallback: string) => (id ? nameOf(id) : fallback)

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle title={existing ? 'Edit result' : 'Log a result'} subtitle={existing ? undefined : 'Takes about 15 seconds.'} />

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-2">Screenshot</h2>
          {settings.require_screenshot && !existing && <Badge tone="accent">Required</Badge>}
        </div>
        {shot || existingShot ? (
          <div>
            <img src={shot?.preview ?? existingShot ?? ''} alt="Screenshot preview" className="w-full rounded-xl border border-line" />
            {read && (
              <div className="mt-3">
                <ReadNote read={read} onRetry={() => readFile.current && void readShot(readFile.current)} />
              </div>
            )}
            {askWho && gameNames?.homeName && gameNames.awayName && (
              <div className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
                <div className="text-sm font-semibold">Which one is you?</div>
                <div className="mt-0.5 text-xs text-muted">
                  {clubName(gameNames.homeName) || clubName(gameNames.awayName)
                    ? 'Tap the team you played as.'
                    : 'Next time these names are filled in for you.'}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {(['home', 'away'] as const).map((side) => (
                    <button
                      type="button"
                      key={side}
                      onClick={() => iAm(side)}
                      className="flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm font-semibold transition hover:border-accent/60"
                    >
                      <Gamepad2 className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <span className="truncate">{side === 'home' ? gameNames.homeName : gameNames.awayName}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => iAm(null)} className="mt-2 text-xs font-semibold text-muted hover:text-ink">
                  Neither, I'm logging it for friends
                </button>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {processing ? 'Shrinking…' : shot ? `Ready · shrunk to ${formatBytes(shot.data.full.size)}` : 'Current screenshot'}
              </span>
              <label className={buttonClass('secondary', 'sm')}>
                <input type="file" accept="image/*" className="sr-only" onChange={onFileInput} />
                Replace
              </label>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2/40 px-4 py-9 text-center transition hover:border-accent/60">
            {processing ? (
              <LoaderCircle className="h-8 w-8 animate-spin text-accent" aria-hidden />
            ) : (
              <ImagePlus className="h-8 w-8 text-accent" aria-hidden />
            )}
            <span className="font-semibold">{processing ? 'Shrinking…' : 'Add the full-time screenshot'}</span>
            <span className="text-xs text-muted">The score, players and match stats are read from it for you.</span>
            <input type="file" accept="image/*" className="sr-only" onChange={onFileInput} />
          </label>
        )}
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-2">Who played?</h2>
          <button
            type="button"
            onClick={swap}
            disabled={!homeId || !awayId}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Swap sides
          </button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <Slot
            league={league}
            id={homeId}
            label="Home"
            isMe={homeId === me.id}
            active={picking === 'home'}
            gameName={gameNames?.homeName}
            onClick={() => setPicking((p) => (p === 'home' ? null : 'home'))}
          />
          <span className="font-display text-xl font-bold text-muted">VS</span>
          <Slot
            league={league}
            id={awayId}
            label="Away"
            isMe={awayId === me.id}
            active={picking === 'away'}
            gameName={gameNames?.awayName}
            onClick={() => setPicking((p) => (p === 'away' ? null : 'away'))}
          />
        </div>
        {picking && (
          <div className="mt-4 animate-rise border-t border-line pt-4">
            <div className="mb-2.5 text-xs text-muted">{picking === 'home' ? 'Pick the home player' : 'Pick the opponent'}</div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {selectable.map((p) => {
                const taken = (picking === 'home' ? awayId : homeId) === p.id
                const selected = (picking === 'home' ? homeId : awayId) === p.id
                return (
                  <button
                    type="button"
                    key={p.id}
                    disabled={taken}
                    onClick={() => pick(p.id)}
                    className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition disabled:opacity-25 ${
                      selected ? 'bg-accent/12 ring-1 ring-accent' : 'hover:bg-surface-2'
                    }`}
                  >
                    <Avatar league={league} id={p.id} size={44} />
                    <span className="w-full truncate text-center text-xs font-semibold">{p.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-4 text-sm font-semibold text-ink-2">Score</h2>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
          <Stepper value={hg} onChange={setHg} label={`${label(homeId, 'Home')} goals`} />
          <span className="pt-3 text-4xl leading-none font-bold text-muted">–</span>
          <Stepper value={ag} onChange={setAg} label={`${label(awayId, 'Away')} goals`} />
        </div>
        {draw && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Went to penalties?</div>
                <div className="text-xs text-muted">The shootout winner gets the win. Shootout goals don't count.</div>
              </div>
              <Toggle checked={pensOn} onChange={setPensOn} label="Went to penalties" />
            </div>
            {pensOn && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[homeId, awayId].map((pid, i) => (
                  <button
                    type="button"
                    key={i}
                    disabled={!pid}
                    onClick={() => setPensWinner(pid)}
                    className={`h-11 truncate rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-40 ${
                      pid && pensWinner === pid ? 'border-gold bg-gold/12 text-gold' : 'border-line-strong bg-surface-2 text-ink-2'
                    }`}
                  >
                    {label(pid, i === 0 ? 'Home' : 'Away')} won
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="flex w-full items-center gap-2 p-4 text-left text-sm font-semibold text-ink-2"
        >
          More details
          <span className="text-xs font-normal text-muted">date, teams, notes</span>
          <ChevronDown className={`ml-auto h-4 w-4 transition ${more ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {more && (
          <div className="space-y-4 border-t border-line p-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-2">When was it played?</span>
              <input
                type="datetime-local"
                className="field"
                value={playedAt}
                max={toLocalInputValue(new Date())}
                onChange={(e) => setPlayedAt(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="mb-1.5 block truncate text-sm text-ink-2">{label(homeId, 'Home')}'s team</span>
                <input className="field" list="team-suggestions" maxLength={40} value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Optional" />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block truncate text-sm text-ink-2">{label(awayId, 'Away')}'s team</span>
                <input className="field" list="team-suggestions" maxLength={40} value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Optional" />
              </label>
            </div>
            <datalist id="team-suggestions">
              {teams.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-2">Notes</span>
              <textarea
                className="field min-h-20"
                maxLength={280}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Last-minute winner, lag, rage quit…"
              />
            </label>
          </div>
        )}
      </section>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
        {formError && (
          <p role="alert" className="mb-2 rounded-xl border border-loss/40 bg-[#2a1216] px-3.5 py-2.5 text-sm text-[#ffd0d0]">
            {formError}
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={saving}
          disabled={processing}
          onClick={() => void submit()}
          icon={<Check className="h-5 w-5" strokeWidth={2.75} />}
        >
          {existing ? 'Save changes' : 'Save result'}
        </Button>
      </div>
    </div>
  )
}

export default function AddMatch() {
  const { id } = useParams()
  const { league, error, refetch } = useLeague()
  const { ready, session, me, meLoading, isMember, isAdmin } = useAuth()

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!ready || meLoading || !league) return <PageSkeleton />
  if (!session) return <SignInPrompt reason="to log a result" />
  if (!isMember || !me) return <WaitingForApproval />

  if (id) {
    const existing = league.matches.find((m) => m.id === id)
    if (!isAdmin) {
      return (
        <EmptyState icon={SearchX} title="Admins only">
          Only an admin can edit results. If a score is wrong, dispute it from the match page.
        </EmptyState>
      )
    }
    if (!existing) {
      return (
        <EmptyState icon={SearchX} title="Match not found">
          <Link to="/matches" className={buttonClass('secondary', 'md', 'mt-4')}>
            Back to matches
          </Link>
        </EmptyState>
      )
    }
    return <MatchForm key={existing.id} league={league} me={me} existing={existing} />
  }
  return <MatchForm league={league} me={me} existing={null} />
}
