// The share pictures: 1080 x 1350 posters drawn on a canvas, so they come out the same on every
// phone. Each returns a PNG.
import { BrickWall, CalendarDays, Crown, Drum, Flame, Footprints, Volume2, Zap, type LucideIcon } from 'lucide-react'
import type { League } from '../queries'
import { matchStatLines } from '../matchStats'
import { cardRating, cardStars, formatPerGame, formatPoints, headToHead, sideOf, signed, winnerOf, type Row, type WeekResult } from '../stats'
import { clockTime, monthCardLabel, shortDate } from '../time'
import type { Match } from '../types'
import { cardBackground, iconImage } from './art'
import {
  DISPLAY,
  H,
  SANS,
  W,
  avatar,
  cardShape,
  clip,
  containBox,
  ensureFonts,
  fitFont,
  glow,
  loadImage,
  newCanvas,
  roundRect,
  spacing,
  toBlob,
  withAlpha,
  withShadow,
  type Ctx,
} from './draw'

type Kind = 'potw' | 'chenda' | 'potm'

type Theme = {
  bg: [string, string]
  accent: string
  neon: string
  tunnel1: string
  tunnel3: string
  bronze: string
  frame: string[]
  statLabel: string
}

const THEMES: Record<Kind | 'plain', Theme> = {
  potw: {
    bg: ['#03100a', '#08201a'],
    accent: '#f6d77a',
    neon: '#3dff7a',
    tunnel1: '#12592a',
    tunnel3: '#010c05',
    bronze: '#e9c47c',
    frame: ['#f6dfa0', '#9a6a33', '#f1d391', '#6e4521', '#e7c17a'],
    statLabel: '#b6c7bb',
  },
  chenda: {
    bg: ['#1b0604', '#2b0b06'],
    accent: '#ffad6b',
    neon: '#ff8a3d',
    tunnel1: '#8f1d12',
    tunnel3: '#150302',
    bronze: '#f3c46a',
    frame: ['#ffe7a8', '#9a5a1c', '#f8d27c', '#64340f', '#eeb55c'],
    statLabel: '#dcc1a9',
  },
  potm: {
    bg: ['#1a0508', '#2a0a0c'],
    accent: '#ffb052',
    neon: '#ff8a1c',
    tunnel1: '#7c1d0b',
    tunnel3: '#11040a',
    bronze: '#f4bd6c',
    frame: ['#ffdca2', '#8c4a1a', '#f6c47c', '#5a280c', '#eaa95a'],
    statLabel: '#e2c2a6',
  },
  plain: {
    bg: ['#050816', '#0d1630'],
    accent: '#3dff8f',
    neon: '#3dff8f',
    tunnel1: '#16264d',
    tunnel3: '#050816',
    bronze: '#22d3ee',
    frame: [],
    statLabel: '#8090b8',
  },
}

const INK = '#f2f5ff'
const INK_2 = '#b9c3e4'
const MUTED = '#8090b8'

/* ------------------------------------------------------------------
   Shared layout: background, heading and footer
   ------------------------------------------------------------------ */

function backdrop(ctx: Ctx, t: Theme) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, t.bg[0])
  g.addColorStop(0.55, t.bg[1])
  g.addColorStop(1, t.bg[0])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  glow(ctx, 180, 260, 620, t.neon, 0.13)
  glow(ctx, 940, 1150, 640, t.accent, 0.1)
}

function heading(ctx: Ctx, t: Theme, group: string, first: string, rest: string, subtitle: string) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  ctx.font = `700 26px ${SANS}`
  spacing(ctx, 6)
  ctx.fillText(clip(ctx, group.toUpperCase(), W - 160), W / 2, 92)
  spacing(ctx, 0)

  const font = (px: number) => `italic 700 ${px}px ${DISPLAY}`
  const full = `${first} ${rest}`.toUpperCase()
  fitFont(ctx, full, W - 120, 108, font, 50)
  const a = `${first.toUpperCase()} `
  const wa = ctx.measureText(a).width
  const wb = ctx.measureText(rest.toUpperCase()).width
  const x0 = W / 2 - (wa + wb) / 2
  ctx.textAlign = 'left'
  withShadow(ctx, 'rgba(0,0,0,0.5)', 20, () => {
    ctx.fillStyle = INK
    ctx.fillText(a, x0, 196)
    ctx.fillStyle = t.accent
    ctx.fillText(rest.toUpperCase(), x0 + wa, 196)
  })
  ctx.textAlign = 'center'
  ctx.fillStyle = INK_2
  ctx.font = `600 30px ${SANS}`
  ctx.fillText(clip(ctx, subtitle, W - 160), W / 2, 248)
}

function footer(ctx: Ctx, t: Theme) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = withAlpha(t.accent, 0.35)
  ctx.fillRect(W / 2 - 40, 1262, 80, 3)
  ctx.fillStyle = MUTED
  ctx.font = `600 26px ${SANS}`
  ctx.fillText(location.host, W / 2, 1306)
}

/* ------------------------------------------------------------------
   The card
   ------------------------------------------------------------------ */

export type CardSpec = {
  kind: Kind
  row: Row | null
  caption: string
  /** Player of the Month: the month's key. */
  month?: string
}

type Pt = [number, number]
const OUTER: Pt[] = [[7, 0.6], [93, 0.6], [99.4, 7], [99.4, 136], [93, 142.4], [7, 142.4], [0.6, 136], [0.6, 7]]
const INNER: Pt[] = [[9, 2.8], [40, 2.8], [42, 4.2], [58, 4.2], [60, 2.8], [91, 2.8], [97.2, 9], [97.2, 134], [91, 140.2], [9, 140.2], [2.8, 134], [2.8, 9]]
const CORNERS: Pt[][] = [
  [[2.8, 16], [2.8, 9], [9, 2.8], [17, 2.8]],
  [[83, 2.8], [91, 2.8], [97.2, 9], [97.2, 16]],
  [[2.8, 127], [2.8, 134], [9, 140.2], [17, 140.2]],
  [[83, 140.2], [91, 140.2], [97.2, 134], [97.2, 127]],
]
const PLATE: Pt[] = [[33, 143], [33, 132.4], [36, 129.4], [64, 129.4], [67, 132.4], [67, 143]]
/** The month card's wide plate with stepped wings. */
const WIDE_PLATE: Pt[] = [[18, 143], [23, 138.2], [28.5, 138.2], [32, 129], [68, 129], [71.5, 138.2], [77, 138.2], [82, 143]]

function poly(ctx: Ctx, pts: Pt[], x: number, y: number, w: number, h: number, close: boolean) {
  ctx.beginPath()
  pts.forEach(([u, v], i) => (i ? ctx.lineTo(x + (u * w) / 100, y + (v * h) / 143) : ctx.moveTo(x + (u * w) / 100, y + (v * h) / 143)))
  if (close) ctx.closePath()
}

/**
 * The month card's face, like a special-edition card: a big outlined rating and position, the
 * month on a small plate where a flag would be, and the date and name centred at the bottom.
 */
function drawMonthFace(ctx: Ctx, spec: CardSpec, name: string, rating: number | null, x: number, y: number, w: number, h: number) {
  const pad = 0.08 * w
  const outlined = (text: string, tx: number, ty: number, px: number) => {
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, px * 0.09)
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    withShadow(ctx, 'rgba(0,0,0,0.7)', px * 0.25, () => ctx.strokeText(text, tx, ty), px * 0.04)
    ctx.fillStyle = '#fff'
    ctx.fillText(text, tx, ty)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const top = y + 0.07 * w
  const ratingPx = 0.19 * w
  ctx.font = `900 ${ratingPx}px ${SANS}`
  spacing(ctx, -0.05 * ratingPx)
  outlined(rating == null ? '??' : String(rating), x + pad, top, ratingPx)
  const posPx = 0.086 * w
  const posY = top + ratingPx * 0.98
  ctx.font = `900 ${posPx}px ${SANS}`
  spacing(ctx, -0.03 * posPx)
  outlined('POTM', x + pad, posY, posPx)
  spacing(ctx, 0)

  const label = spec.month ? monthCardLabel(spec.month).slice(0, 3).toUpperCase() : 'POTM'
  const bw = 0.19 * w
  const bh = 0.1267 * w
  const bx = x + pad
  const by = posY + posPx + 0.03 * w
  const plate = ctx.createLinearGradient(bx, by, bx + bw, by + bh)
  plate.addColorStop(0, '#fff1c4')
  plate.addColorStop(0.55, '#ffb340')
  plate.addColorStop(1, '#e8641a')
  withShadow(
    ctx,
    'rgba(0,0,0,0.5)',
    0.02 * w,
    () => {
      roundRect(ctx, bx, by, bw, bh, 0.008 * w)
      ctx.fillStyle = plate
      ctx.fill()
    },
    0.006 * w,
  )
  ctx.lineWidth = 0.0045 * w
  ctx.strokeStyle = '#f4f1ea'
  roundRect(ctx, bx, by, bw, bh, 0.008 * w)
  ctx.stroke()
  ctx.fillStyle = '#2a0c02'
  ctx.font = `800 ${0.064 * w}px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1)

  ctx.textBaseline = 'alphabetic'
  const nameBase = y + h - 0.31 * w
  const namePx = fitFont(ctx, name, w - 2 * pad, 0.086 * w, (px) => `800 ${px}px ${SANS}`, 0.05 * w)
  outlined(name, x + w / 2, nameBase, namePx)
  const datePx = 0.056 * w
  ctx.font = `800 ${datePx}px ${SANS}`
  outlined(clip(ctx, spec.caption, w - 2 * pad), x + w / 2, nameBase - namePx * 1.1, datePx)
}

async function drawCard(ctx: Ctx, league: League, spec: CardSpec, x: number, y: number, w: number, h: number) {
  const { kind, row } = spec
  const t = THEMES[kind]
  const id = row?.playerId
  const player = id ? league.byId.get(id) : undefined
  const name = player?.name ?? (kind === 'chenda' ? 'Nobody yet' : 'Up for grabs')
  const color = id ? league.colorOf(id) : '#3b4566'
  const rating = row ? cardRating(row) : null
  const stars = cardStars(rating)
  const stats =
    kind === 'chenda'
      ? [
          { label: 'LOST', value: row?.lost },
          { label: 'CONCEDED', value: row?.ga },
          { label: 'PTS/GAME', value: row ? formatPerGame(row) : undefined },
        ]
      : [
          { label: 'GOALS', value: row?.gf },
          { label: 'WINS', value: row?.won },
          { label: 'CLEAN SHEETS', value: row?.cleanSheets },
        ]
  const chipIcons: LucideIcon[] = kind === 'chenda' ? [Drum, Volume2] : kind === 'potm' ? [CalendarDays, Crown] : [Crown, Flame]

  const [art, figure, photo, badge, ...chips] = await Promise.all([
    cardBackground(kind, !row, Math.round(w), Math.round(h)),
    row ? loadImage(player?.card_url) : Promise.resolve(null),
    row ? loadImage(player?.avatar_url) : Promise.resolve(null),
    kind === 'potw' ? iconImage(Crown, t.bronze, Math.round(w * 0.09)) : kind === 'chenda' ? iconImage(Drum, t.bronze, Math.round(w * 0.07)) : Promise.resolve(null),
    ...chipIcons.map((I, i) =>
      iconImage(I, kind === 'potm' ? (i === 0 ? '#7ff3ff' : '#8d94a3') : '#fff1dc', Math.round(w * (kind === 'potm' ? 0.034 : 0.04))),
    ),
  ])

  // Glow and shadow behind the card
  withShadow(ctx, withAlpha(t.neon, 0.45), 90, () => {
    cardShape(ctx, x, y, w, h)
    ctx.fillStyle = t.tunnel3
    ctx.fill()
  })

  ctx.save()
  cardShape(ctx, x, y, w, h)
  ctx.clip()
  ctx.fillStyle = t.tunnel3
  ctx.fillRect(x, y, w, h)
  if (art.back) ctx.drawImage(art.back, x, y, w, h)

  const portrait = (cx: number, cy: number, r: number) => {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(t.tunnel3, 0.85)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2)
    ctx.fillStyle = t.bronze
    ctx.fill()
    ctx.restore()
    withShadow(ctx, withAlpha(t.neon, 0.4), 40, () => avatar(ctx, photo, cx, cy, r, color, row ? name : '?'))
  }

  if (kind === 'chenda') {
    if (figure) {
      const b = containBox(figure, x, y + 0.04 * h, w, 0.66 * h)
      withShadow(ctx, 'rgba(0,0,0,0.55)', 30, () => ctx.drawImage(figure, b.x, b.y, b.w, b.h), 8)
    } else portrait(x + w / 2, y + 0.355 * h, 0.155 * h)
    if (art.front) ctx.drawImage(art.front, x, y, w, h)
  } else if (figure) {
    // The month card's figure is bigger: from near the top down past the name.
    const b =
      kind === 'potm'
        ? containBox(figure, x - 0.3 * w, y + 0.12 * h, 1.6 * w, 0.82 * h)
        : containBox(figure, x - 0.175 * w, y + 0.06 * h, 1.35 * w, 0.76 * h)
    const off = newCanvas(Math.max(1, Math.ceil(b.w)), Math.max(1, Math.ceil(b.h)))
    off.ctx.drawImage(figure, 0, 0, b.w, b.h)
    off.ctx.globalCompositeOperation = 'destination-in'
    const fade = off.ctx.createLinearGradient(0, 0, 0, b.h)
    fade.addColorStop(0, '#000')
    fade.addColorStop(kind === 'potm' ? 0.82 : 0.74, '#000')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    off.ctx.fillStyle = fade
    off.ctx.fillRect(0, 0, b.w, b.h)
    if (kind === 'potm') withShadow(ctx, 'rgba(0,0,0,0.55)', 0.04 * w, () => ctx.drawImage(off.canvas, b.x, b.y), 0.012 * w)
    withShadow(ctx, withAlpha(kind === 'potm' ? '#ffaa3c' : t.neon, 0.4), 40, () => ctx.drawImage(off.canvas, b.x, b.y))
  } else portrait(x + w / 2, y + 0.4 * h, 0.28 * w)

  // Shade so the text reads over the light (only a touch on the month card: its fire stays bright)
  const shade = ctx.createLinearGradient(0, y, 0, y + h)
  if (kind === 'potm') {
    shade.addColorStop(0, 'rgba(40,4,0,0.3)')
    shade.addColorStop(0.18, 'rgba(40,4,0,0)')
    shade.addColorStop(0.64, 'rgba(40,5,0,0)')
    shade.addColorStop(0.82, 'rgba(40,5,0,0.38)')
    shade.addColorStop(1, 'rgba(24,3,0,0.62)')
  } else {
    shade.addColorStop(0, withAlpha(t.tunnel3, 0.6))
    shade.addColorStop(0.22, withAlpha(t.tunnel3, 0))
    shade.addColorStop(0.52, withAlpha(t.tunnel3, 0))
    shade.addColorStop(0.78, withAlpha(t.tunnel3, 0.86))
    shade.addColorStop(1, withAlpha(t.tunnel3, 0.96))
  }
  ctx.fillStyle = shade
  ctx.fillRect(x, y, w, h)

  if (kind === 'potm') drawMonthFace(ctx, spec, name, rating, x, y, w, h)
  else drawFace()
  ctx.restore()

  function drawFace() {
    const pad = 0.09 * w
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    // Rating and position
    ctx.font = `italic 700 ${0.18 * w}px ${DISPLAY}`
    withShadow(ctx, '#000', 14, () => {
      ctx.fillStyle = '#fff6dc'
      ctx.fillText(rating == null ? '??' : String(rating), x + pad, y + pad)
    })
    ctx.font = `900 ${0.036 * w}px ${SANS}`
    spacing(ctx, 0.008 * w)
    ctx.fillStyle = t.bronze
    ctx.fillText(kind === 'chenda' ? 'CHENDA' : 'POTW', x + pad, y + pad + 0.18 * w * 0.92)
    spacing(ctx, 0)
    // The badge, top right
    if (badge) {
      const s = badge.width
      ctx.drawImage(badge, x + w - pad - s, y + pad)
      if (kind === 'chenda') {
        ctx.font = `700 ${0.04 * w}px ${SANS}`
        ctx.fillStyle = t.bronze
        ctx.textAlign = 'right'
        ctx.fillText('ചെണ്ട', x + w - pad, y + pad + s + 0.012 * w)
        ctx.textAlign = 'left'
      }
    }

    // Name, caption and stats, from the bottom up
    ctx.textBaseline = 'alphabetic'
    const statsBottom = y + h - 0.15 * w
    const labelPx = 0.029 * w
    const valuePx = 0.076 * w
    const valueBase = statsBottom - labelPx - 0.015 * w
    const statsTop = valueBase - valuePx
    const dividerY = statsTop - 0.03 * w
    const cols = stats.map((s) => {
      ctx.font = `800 ${valuePx}px ${SANS}`
      const vw = ctx.measureText(String(s.value ?? '–')).width
      ctx.font = `800 ${labelPx}px ${SANS}`
      return Math.max(vw, ctx.measureText(s.label).width + labelPx * 0.1 * s.label.length)
    })
    const inner = w - 2 * pad
    const gapTotal = inner - cols.reduce((a, b) => a + b, 0)
    let cx = x + pad
    stats.forEach((s, i) => {
      ctx.fillStyle = '#fff'
      ctx.font = `800 ${valuePx}px ${SANS}`
      ctx.fillText(String(s.value ?? '–'), cx, valueBase)
      ctx.fillStyle = t.statLabel
      ctx.font = `800 ${labelPx}px ${SANS}`
      spacing(ctx, labelPx * 0.1)
      ctx.fillText(s.label, cx, statsBottom)
      spacing(ctx, 0)
      cx += cols[i] + gapTotal / 2
    })
    const div = ctx.createLinearGradient(x + pad, 0, x + w - pad, 0)
    div.addColorStop(0, t.bronze)
    div.addColorStop(1, withAlpha(t.bronze, 0))
    ctx.fillStyle = div
    ctx.fillRect(x + pad, dividerY, inner, Math.max(1, 0.002 * w))

    const nameFont = (px: number) => `italic 700 ${px}px ${DISPLAY}`
    const drawName = (baseline: number) => {
      fitFont(ctx, name.toUpperCase(), inner, 0.105 * w, nameFont, 0.06 * w)
      withShadow(ctx, '#000', 12, () => {
        ctx.fillStyle = '#fff'
        ctx.fillText(name.toUpperCase(), x + pad, baseline)
      })
    }
    const capBase = dividerY - 0.035 * w
    ctx.font = `900 ${0.032 * w}px ${SANS}`
    spacing(ctx, 0.006 * w)
    ctx.fillStyle = t.bronze
    ctx.fillText(clip(ctx, spec.caption.toUpperCase(), inner), x + pad, capBase)
    spacing(ctx, 0)
    drawName(capBase - 0.032 * w - 0.015 * w)
  }

  // Bronze frame, corner accents and the bottom plate
  const frame = ctx.createLinearGradient(x, y, x + w, y + h)
  t.frame.forEach((c, i) => frame.addColorStop([0, 0.3, 0.55, 0.78, 1][i], c))
  ctx.strokeStyle = frame
  ctx.lineJoin = 'miter'
  ctx.lineWidth = 0.009 * w
  poly(ctx, OUTER, x, y, w, h, true)
  ctx.stroke()
  ctx.lineWidth = 0.0035 * w
  ctx.globalAlpha = 0.85
  poly(ctx, INNER, x, y, w, h, true)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.lineWidth = 0.0075 * w
  for (const c of CORNERS) {
    poly(ctx, c, x, y, w, h, false)
    ctx.stroke()
  }
  poly(ctx, kind === 'potm' ? WIDE_PLATE : PLATE, x, y, w, h, true)
  ctx.fillStyle = withAlpha(t.tunnel3, 0.92)
  ctx.fill()
  ctx.lineWidth = 0.0035 * w
  ctx.stroke()

  // Chips and stars on the plate
  const plateTop = y + h * (1 - 0.013 - 0.086)
  const chipD = 0.064 * w
  const starPx = 0.031 * w
  const block = chipD + 0.009 * w + starPx
  const top = plateTop + (0.086 * h - block) / 2
  chips.forEach((icon, i) => {
    const ccx = x + w / 2 + (i - 0.5) * (chipD + 0.026 * w)
    const ccy = top + chipD / 2
    const g = ctx.createRadialGradient(ccx - chipD * 0.1, ccy - chipD * 0.15, 0, ccx, ccy, chipD / 2)
    if (kind === 'potm') {
      // Outlined hexagons, as on the reference card: one glowing cyan, one dark grey.
      const hex = (r: number) => {
        ctx.beginPath()
        ;[[-0.5, -0.94], [0.5, -0.94], [1, 0], [0.5, 0.94], [-0.5, 0.94], [-1, 0]].forEach(([u, v], k) =>
          k ? ctx.lineTo(ccx + u * r, ccy + v * r) : ctx.moveTo(ccx + u * r, ccy + v * r),
        )
        ctx.closePath()
      }
      const ring = ctx.createLinearGradient(ccx - chipD / 2, ccy - chipD / 2, ccx + chipD / 2, ccy + chipD / 2)
      const [a, b2, c] = i === 0 ? ['#a6f8ff', '#22c4d8', '#0b7f90'] : ['#8b92a0', '#4a505c', '#2a2e36']
      ring.addColorStop(0, a)
      ring.addColorStop(0.5, b2)
      ring.addColorStop(1, c)
      hex(chipD / 2)
      ctx.fillStyle = ring
      ctx.fill()
      g.addColorStop(0, i === 0 ? '#0f3b44' : '#20242c')
      g.addColorStop(1, i === 0 ? '#071a20' : '#111318')
      hex(chipD * 0.37)
      ctx.fillStyle = g
      ctx.fill()
    } else {
      g.addColorStop(0, t.tunnel1)
      g.addColorStop(1, t.tunnel3)
      withShadow(ctx, withAlpha(t.neon, 0.35), 0.02 * w, () => {
        ctx.beginPath()
        ctx.arc(ccx, ccy, chipD / 2, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      })
      ctx.lineWidth = 0.0045 * w
      ctx.strokeStyle = withAlpha(t.neon, 0.6)
      ctx.stroke()
    }
    if (icon) ctx.drawImage(icon, ccx - icon.width / 2, ccy - icon.height / 2)
  })
  ctx.font = `700 ${starPx}px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#f3d27a' : 'rgba(243,210,122,0.22)'
    ctx.fillText('★', x + w / 2 + (i - 2) * starPx * 1.12, top + chipD + 0.009 * w)
  }
}

/* ------------------------------------------------------------------
   Posters
   ------------------------------------------------------------------ */

const CARD_TITLES: Record<Kind, [string, string]> = {
  potw: ['Player', 'of the week'],
  chenda: ['Chenda', 'of the week'],
  potm: ['Player', 'of the month'],
}

/** A big card in the middle, with a line about the numbers underneath. */
export async function cardPoster(league: League, spec: CardSpec & { subtitle: string; title?: [string, string] }) {
  await ensureFonts()
  const { canvas, ctx } = newCanvas()
  const t = THEMES[spec.kind]
  backdrop(ctx, t)
  const [first, rest] = spec.title ?? CARD_TITLES[spec.kind]
  heading(ctx, t, league.settings.group_name, first, rest, spec.subtitle)
  const cw = 620
  const ch = (cw * 143) / 100
  await drawCard(ctx, league, spec, (W - cw) / 2, 300, cw, ch)
  const r = spec.row
  if (r) {
    const line =
      spec.kind === 'chenda'
        ? `${formatPerGame(r)} pts a game · ${r.won}W ${r.drawn}D ${r.lost}L · ${r.gf}–${r.ga}`
        : `${formatPoints(r.points)} pts · ${r.won}W ${r.drawn}D ${r.lost}L · ${r.gf} goals`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.font = `600 34px ${SANS}`
    ctx.fillText(clip(ctx, line, W - 140), W / 2, 1238)
  }
  footer(ctx, t)
  return toBlob(canvas)
}

/** Full time: both players, the score, and the match stats or their record together. */
export async function matchPoster(league: League, m: Match) {
  await ensureFonts()
  const { canvas, ctx } = newCanvas()
  const t = THEMES.plain
  backdrop(ctx, t)
  heading(ctx, t, league.settings.group_name, 'Full', 'time', `${shortDate(m.played_at, league.tz)} · ${clockTime(m.played_at, league.tz)}`)

  const winner = winnerOf(m)
  const sides = [
    { id: m.home_id, x: 250, team: m.home_team },
    { id: m.away_id, x: 830, team: m.away_team },
  ]
  const photos = await Promise.all(sides.map((s) => loadImage(league.byId.get(s.id)?.avatar_url)))
  sides.forEach((s, i) => {
    const won = winner === s.id
    if (won) glow(ctx, s.x, 520, 260, t.accent, 0.22)
    withShadow(ctx, 'rgba(0,0,0,0.6)', 30, () =>
      avatar(ctx, photos[i], s.x, 520, 140, league.colorOf(s.id), league.nameOf(s.id), won ? t.accent : 'rgba(255,255,255,0.14)'),
    )
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    const name = league.nameOf(s.id).toUpperCase()
    fitFont(ctx, name, 400, 64, (px) => `italic 700 ${px}px ${DISPLAY}`, 34)
    ctx.fillText(name, s.x, 760)
    if (s.team) {
      ctx.fillStyle = MUTED
      ctx.font = `600 28px ${SANS}`
      ctx.fillText(clip(ctx, s.team, 400), s.x, 804)
    }
    const pill = won ? (m.pens_winner_id ? 'WON ON PENS' : 'WIN') : winner ? '' : 'DRAW'
    if (pill) {
      ctx.font = `800 24px ${SANS}`
      spacing(ctx, 3)
      const pw = ctx.measureText(pill).width + 40
      roundRect(ctx, s.x - pw / 2, 832, pw, 46, 23)
      ctx.fillStyle = won ? withAlpha(t.accent, 0.16) : 'rgba(255,255,255,0.08)'
      ctx.fill()
      ctx.fillStyle = won ? t.accent : INK_2
      ctx.textBaseline = 'middle'
      ctx.fillText(pill, s.x, 856)
      spacing(ctx, 0)
      ctx.textBaseline = 'alphabetic'
    }
  })
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  const score = `${m.home_goals}–${m.away_goals}`
  fitFont(ctx, score, 270, 190, (px) => `italic 700 ${px}px ${DISPLAY}`, 90)
  withShadow(ctx, withAlpha(t.accent, 0.35), 40, () => ctx.fillText(score, W / 2, 590))

  const lines = matchStatLines(m).slice(0, 4)
  const top = 950
  if (lines.length) {
    lines.forEach((l, i) => {
      const yy = top + i * 74
      ctx.fillStyle = INK
      ctx.font = `700 32px ${SANS}`
      ctx.textAlign = 'left'
      ctx.fillText(l.home, 110, yy)
      ctx.textAlign = 'right'
      ctx.fillText(l.away, W - 110, yy)
      ctx.textAlign = 'center'
      ctx.fillStyle = MUTED
      ctx.font = `600 24px ${SANS}`
      ctx.fillText(l.label.toUpperCase(), W / 2, yy - 4)
      const bx = 110
      const bw = W - 220
      const split = bw * l.share
      roundRect(ctx, bx, yy + 16, Math.max(0, split - 3), 10, 5)
      ctx.fillStyle = league.colorOf(m.home_id)
      ctx.fill()
      roundRect(ctx, bx + split + 3, yy + 16, Math.max(0, bw - split - 3), 10, 5)
      ctx.fillStyle = league.colorOf(m.away_id)
      ctx.fill()
    })
  } else {
    const h2h = headToHead(league.matches, m.home_id, m.away_id)
    if (h2h.played > 1) {
      ctx.fillStyle = MUTED
      ctx.font = `700 24px ${SANS}`
      spacing(ctx, 4)
      ctx.fillText('ALL-TIME HEAD TO HEAD', W / 2, top + 20)
      spacing(ctx, 0)
      ctx.fillStyle = INK
      ctx.font = `italic 700 72px ${DISPLAY}`
      ctx.fillText(`${h2h.aWins}  ·  ${h2h.draws}  ·  ${h2h.bWins}`, W / 2, top + 110)
      ctx.fillStyle = INK_2
      ctx.font = `600 28px ${SANS}`
      ctx.fillText(`${league.nameOf(m.home_id)} wins · draws · ${league.nameOf(m.away_id)} wins`, W / 2, top + 160)
    }
  }
  footer(ctx, t)
  return toBlob(canvas)
}

/** A table: rank, player, games, record, goal difference and points. */
export async function tablePoster(
  league: League,
  opts: { rows: Row[]; first: string; rest: string; subtitle: string; crownId?: string | null; drumId?: string | null },
) {
  await ensureFonts()
  const { canvas, ctx } = newCanvas()
  const t = THEMES.plain
  backdrop(ctx, t)
  heading(ctx, t, league.settings.group_name, opts.first, opts.rest, opts.subtitle)
  const rows = opts.rows.slice(0, 8)
  const [photos, crown, drum] = await Promise.all([
    Promise.all(rows.map((r) => loadImage(league.byId.get(r.playerId)?.avatar_url))),
    iconImage(Crown, '#ffcf4d', 34),
    iconImage(Drum, '#ff8a3d', 34),
  ])
  const cols = { rank: 92, avatar: 170, name: 222, p: 600, wdl: 718, gd: 836, pts: 948 }
  ctx.fillStyle = MUTED
  ctx.font = `700 22px ${SANS}`
  spacing(ctx, 3)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.fillText('P', cols.p, 318)
  ctx.fillText('W-D-L', cols.wdl, 318)
  ctx.fillText('GD', cols.gd, 318)
  ctx.fillText('PTS', cols.pts, 318)
  spacing(ctx, 0)
  const rowH = Math.min(124, 860 / Math.max(1, rows.length))
  rows.forEach((r, i) => {
    const top = 340 + i * rowH
    const mid = top + rowH / 2
    roundRect(ctx, 60, top + 6, W - 120, rowH - 12, 22)
    ctx.fillStyle = i === 0 ? withAlpha('#ffcf4d', 0.08) : i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.05)'
    ctx.fill()
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillStyle = i === 0 ? '#ffcf4d' : MUTED
    ctx.font = `800 30px ${SANS}`
    ctx.fillText(String(i + 1), cols.rank, mid)
    avatar(ctx, photos[i], cols.avatar, mid, Math.min(38, rowH * 0.36), league.colorOf(r.playerId), league.nameOf(r.playerId))
    ctx.textAlign = 'left'
    ctx.fillStyle = r.qualified || !opts.crownId ? INK : INK_2
    const name = league.nameOf(r.playerId)
    fitFont(ctx, name, 290, 40, (px) => `700 ${px}px ${SANS}`, 24)
    const shown = clip(ctx, name, 290)
    ctx.fillText(shown, cols.name, mid)
    const nx = cols.name + ctx.measureText(shown).width + 14
    if (r.playerId === opts.crownId && crown) ctx.drawImage(crown, nx, mid - 17)
    if (r.playerId === opts.drumId && drum) ctx.drawImage(drum, nx, mid - 17)
    ctx.textAlign = 'center'
    ctx.fillStyle = INK_2
    ctx.font = `600 32px ${SANS}`
    ctx.fillText(String(r.played), cols.p, mid)
    ctx.fillText(`${r.won}-${r.drawn}-${r.lost}`, cols.wdl, mid)
    ctx.fillText(signed(r.gd), cols.gd, mid)
    ctx.fillStyle = i === 0 ? '#ffcf4d' : INK
    ctx.font = `800 36px ${SANS}`
    ctx.fillText(formatPoints(r.points), cols.pts, mid)
  })
  footer(ctx, t)
  return toBlob(canvas)
}

export type AwardIcon = 'boot' | 'wall' | 'win'
const AWARD_ICONS: Record<AwardIcon, { icon: LucideIcon; color: string }> = {
  boot: { icon: Footprints, color: '#ffcf4d' },
  wall: { icon: BrickWall, color: '#22d3ee' },
  win: { icon: Zap, color: '#3dff8f' },
}

/** One award: its icon, the winner (or winners) and what they did. */
export async function awardPoster(league: League, opts: { icon: AwardIcon; first: string; rest: string; subtitle: string; ids: string[]; detail: string }) {
  await ensureFonts()
  const { canvas, ctx } = newCanvas()
  const { icon, color } = AWARD_ICONS[opts.icon]
  const t = { ...THEMES.plain, accent: color, neon: color }
  backdrop(ctx, t)
  heading(ctx, t, league.settings.group_name, opts.first, opts.rest, opts.subtitle)
  const ids = opts.ids.slice(0, 3)
  const [img, ...photos] = await Promise.all([iconImage(icon, color, 150, 1.6), ...ids.map((id) => loadImage(league.byId.get(id)?.avatar_url))])
  glow(ctx, W / 2, 430, 220, color, 0.3)
  if (img) withShadow(ctx, withAlpha(color, 0.8), 40, () => ctx.drawImage(img, W / 2 - 75, 355))
  const r = ids.length === 1 ? 180 : ids.length === 2 ? 150 : 120
  ids.forEach((id, i) => {
    const cx = W / 2 + (i - (ids.length - 1) / 2) * (r * 2 + 50)
    withShadow(ctx, 'rgba(0,0,0,0.6)', 30, () => avatar(ctx, photos[i], cx, 760, r, league.colorOf(id), league.nameOf(id), color))
  })
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  const names = ids.map(league.nameOf).join(' & ').toUpperCase()
  fitFont(ctx, names, W - 140, 96, (px) => `italic 700 ${px}px ${DISPLAY}`, 44)
  ctx.fillText(names, W / 2, 1060)
  ctx.fillStyle = color
  ctx.font = `700 44px ${SANS}`
  ctx.fillText(clip(ctx, opts.detail, W - 140), W / 2, 1130)
  footer(ctx, t)
  return toBlob(canvas)
}

/** The week in one picture: every award and how much was played. */
export async function weekPoster(league: League, week: WeekResult, subtitle: string) {
  await ensureFonts()
  const { canvas, ctx } = newCanvas()
  const t = THEMES.plain
  backdrop(ctx, t)
  heading(ctx, t, league.settings.group_name, 'Week', 'in review', subtitle)
  const a = week.awards
  const big = a.biggestWin
  const bigWinner = big ? winnerOf(big) : null
  const items: { icon: LucideIcon; color: string; label: string; ids: string[]; detail: string }[] = [
    { icon: Crown, color: '#ffcf4d', label: 'Player of the Week', ids: week.winner ? [week.winner.playerId] : [], detail: week.winner ? `${formatPoints(week.winner.points)} pts` : '' },
    { icon: Footprints, color: '#ffcf4d', label: 'Golden Boot', ids: a.goldenBoot?.ids ?? [], detail: a.goldenBoot ? `${a.goldenBoot.goals} goals` : '' },
    { icon: BrickWall, color: '#22d3ee', label: 'The Wall', ids: a.wall?.ids ?? [], detail: a.wall ? `${a.wall.cleanSheets} clean sheets` : '' },
    {
      icon: Zap,
      color: '#3dff8f',
      label: 'Biggest Win',
      ids: bigWinner ? [bigWinner] : [],
      detail: big && bigWinner ? `${sideOf(big, bigWinner).gf}–${sideOf(big, bigWinner).ga} vs ${league.nameOf(sideOf(big, bigWinner).opponentId)}` : '',
    },
    { icon: Drum, color: '#ff8a3d', label: 'Chenda', ids: a.chenda ? [a.chenda.playerId] : [], detail: a.chenda ? `${formatPerGame(a.chenda)} pts a game` : '' },
  ].filter((i) => i.ids.length)
  const icons = await Promise.all(items.map((i) => iconImage(i.icon, i.color, 46)))
  const photos = await Promise.all(items.map((i) => loadImage(league.byId.get(i.ids[0])?.avatar_url)))
  const rowH = 150
  items.forEach((item, i) => {
    const top = 300 + i * rowH
    const mid = top + rowH / 2
    roundRect(ctx, 60, top + 10, W - 120, rowH - 20, 28)
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    ctx.fill()
    glow(ctx, 140, mid, 70, item.color, 0.25)
    if (icons[i]) ctx.drawImage(icons[i]!, 117, mid - 23)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = MUTED
    ctx.font = `700 24px ${SANS}`
    spacing(ctx, 3)
    ctx.fillText(item.label.toUpperCase(), 210, mid - 14)
    spacing(ctx, 0)
    ctx.fillStyle = INK
    const names = item.ids.map(league.nameOf).join(' & ')
    fitFont(ctx, names, 440, 44, (px) => `italic 700 ${px}px ${DISPLAY}`, 28)
    ctx.fillText(clip(ctx, names.toUpperCase(), 440), 210, mid + 36)
    ctx.textAlign = 'right'
    ctx.fillStyle = INK_2
    ctx.font = `600 30px ${SANS}`
    ctx.fillText(clip(ctx, item.detail, 260), W - 190, mid + 12)
    avatar(ctx, photos[i], W - 130, mid, 40, league.colorOf(item.ids[0]), league.nameOf(item.ids[0]))
  })
  const goals = week.matches.reduce((s, m) => s + m.home_goals + m.away_goals, 0)
  ctx.textAlign = 'center'
  ctx.fillStyle = INK_2
  ctx.font = `600 32px ${SANS}`
  ctx.fillText(`${week.matches.length} games · ${goals} goals`, W / 2, 300 + items.length * rowH + 60)
  footer(ctx, t)
  return toBlob(canvas)
}
