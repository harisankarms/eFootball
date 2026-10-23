/**
 * Reads an eFootball full-time screenshot on the phone itself: the two in-game names, the
 * score and the match stats table. Text is recognised by Tesseract (free OCR compiled to
 * WebAssembly), which is downloaded the first time someone uses this and cached after.
 *
 * The screenshot is not read as a whole: the yellow score boxes are found first, then the
 * names beside them, the score digits inside them and the stats table below are each cut
 * out and turned into black-on-white text, which OCR reads far more reliably.
 */

import { STAT_LABELS, similarity, type MatchStats, type StatKey } from './matchStats'

export type ScreenshotReading = {
  homeName: string | null
  awayName: string | null
  homeGoals: number
  awayGoals: number
  stats: MatchStats
}

type Rgb = (r: number, g: number, b: number) => boolean
export type Rect = { x: number; y: number; w: number; h: number }
export type Layout = { homeBox: Rect; awayBox: Rect; homeName: Rect; awayName: Rect; table: Rect; scale: number }

const isYellow: Rgb = (r, g, b) => r > 150 && g > 150 && b < 140 && Math.abs(r - g) < 70
const isDark: Rgb = (r, g, b) => r + g + b < 300

function runs(values: number[], test: (v: number) => boolean) {
  const found: { start: number; end: number }[] = []
  let start = -1
  values.forEach((v, i) => {
    if (test(v)) {
      if (start < 0) start = i
    } else if (start >= 0) {
      found.push({ start, end: i })
      start = -1
    }
  })
  if (start >= 0) found.push({ start, end: values.length })
  return found
}

/** Finds the score boxes and, from them, where the names and the stats table are. */
export function findLayout(img: ImageData): Layout | null {
  const { width: W, height: H, data } = img
  const stage = Math.min(H, (W * 9) / 16)
  const top = (H - stage) / 2
  const cx = W / 2
  const yellow = (x: number, y: number) => {
    const i = (y * W + x) * 4
    return isYellow(data[i], data[i + 1], data[i + 2])
  }

  // Rows across the middle: the score boxes are partly yellow, the "Full Time" bar under them is solid yellow.
  const left = Math.max(0, Math.round(cx - 0.3 * stage))
  const right = Math.min(W, Math.round(cx + 0.3 * stage))
  const y0 = Math.round(top + 0.03 * stage)
  const y1 = Math.round(top + 0.5 * stage)
  const rowFill: number[] = []
  for (let y = y0; y < y1; y++) {
    let n = 0
    for (let x = left; x < right; x++) if (yellow(x, y)) n++
    rowFill.push(n / (right - left))
  }

  for (const band of runs(rowFill, (f) => f > 0.12 && f < 0.8)) {
    const height = band.end - band.start
    if (height < 0.035 * stage || height > 0.14 * stage) continue
    const below = rowFill.slice(band.end, band.end + Math.round(0.03 * stage))
    const barStart = below.findIndex((f) => f >= 0.8)
    if (barStart < 0) continue
    let barEnd = band.end + barStart
    while (barEnd < rowFill.length && rowFill[barEnd] >= 0.8) barEnd++

    const boxTop = y0 + band.start
    const colFill: number[] = []
    for (let x = 0; x < W; x++) {
      let n = 0
      for (let y = boxTop; y < boxTop + height; y++) if (yellow(x, y)) n++
      colFill.push(n / height)
    }
    const boxes = runs(colFill, (f) => f >= 0.3).filter((r) => {
      const w = r.end - r.start
      return w > 0.03 * stage && w < 0.16 * stage && Math.max(...colFill.slice(r.start, r.end)) >= 0.9
    })
    const home = boxes.filter((b) => b.end <= cx + 0.02 * stage).at(-1)
    const away = boxes.find((b) => b.start >= cx - 0.02 * stage)
    if (!home || !away || home === away) continue

    const gap = 0.012 * stage
    const nameTop = boxTop - 0.1 * height
    const nameHeight = height * 1.06
    const homeNameLeft = Math.max(0, cx - 0.95 * stage)
    const awayNameLeft = away.end + gap
    const tableTop = y0 + barEnd + 0.004 * stage
    return {
      homeBox: { x: home.start, y: boxTop, w: home.end - home.start, h: height },
      awayBox: { x: away.start, y: boxTop, w: away.end - away.start, h: height },
      homeName: { x: homeNameLeft, y: nameTop, w: home.start - gap - homeNameLeft, h: nameHeight },
      awayName: { x: awayNameLeft, y: nameTop, w: Math.min(W, cx + 0.95 * stage) - awayNameLeft, h: nameHeight },
      table: { x: cx - 0.345 * stage, y: tableTop, w: 0.69 * stage, h: top + 0.87 * stage - tableTop },
      scale: 1100 / stage,
    }
  }
  return null
}

/** Cuts a part of the screenshot out as black text on white, enlarged and with a margin, ready for OCR. */
export function inkCanvas(source: HTMLCanvasElement, rect: Rect, scale: number, isInk: Rgb, dropRules = false) {
  const x = Math.max(0, Math.floor(rect.x))
  const y = Math.max(0, Math.floor(rect.y))
  const sw = Math.max(1, Math.min(source.width - x, Math.ceil(rect.w)))
  const sh = Math.max(1, Math.min(source.height - y, Math.ceil(rect.h)))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const pad = 16

  const out = document.createElement('canvas')
  out.width = w + pad * 2
  out.height = h + pad * 2
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, x, y, sw, sh, pad, pad, w, h)
  const pixels = ctx.getImageData(pad, pad, w, h)
  const d = pixels.data
  for (let i = 0; i < d.length; i += 4) {
    const v = isInk(d[i], d[i + 1], d[i + 2]) ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  if (dropRules) {
    // The table's thin yellow divider lines would read as text, so rows that are mostly ink are cleared.
    for (let row = 0; row < h; row++) {
      let ink = 0
      for (let col = 0; col < w; col++) if (d[(row * w + col) * 4] === 0) ink++
      if (ink > 0.6 * w) d.fill(255, row * w * 4, (row + 1) * w * 4)
    }
  }
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.putImageData(pixels, pad, pad)
  return out
}

/**
 * Splits the black-and-white stats table into one strip per row of text, so each row is read
 * on its own. The divider lines between rows are only a few pixels tall and are skipped.
 */
export function splitRows(table: HTMLCanvasElement): HTMLCanvasElement[] {
  const { width, height } = table
  const d = table.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data
  const inked: boolean[] = []
  for (let y = 0; y < height; y++) {
    let n = 0
    for (let x = 0; x < width; x++) if (d[(y * width + x) * 4] === 0) n++
    inked.push(n >= 3)
  }
  return runs(
    inked.map((v) => (v ? 1 : 0)),
    (v) => v === 1,
  )
    .filter((r) => r.end - r.start >= 10)
    .map((r) => {
      const margin = 8
      const strip = document.createElement('canvas')
      strip.width = width
      strip.height = r.end - r.start + margin * 2
      const ctx = strip.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, strip.width, strip.height)
      ctx.drawImage(table, 0, r.start, width, r.end - r.start, 0, margin, width, r.end - r.start)
      return strip
    })
}

/**
 * Narrows a black-and-white line of text to the text itself. A short name sits at one end of
 * a wide strip, and the empty space plus any stray specks in it make OCR unsure of itself.
 */
export function trimToText(line: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = line
  const d = line.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data
  const ink: number[] = []
  for (let x = 0; x < width; x++) {
    let n = 0
    for (let y = 0; y < height; y++) if (d[(y * width + x) * 4] === 0) n++
    ink.push(n)
  }
  // Group inked columns into clusters, allowing gaps the size of a word space.
  const clusters: { start: number; end: number; ink: number }[] = []
  const gap = height * 0.6
  for (let x = 0; x < width; x++) {
    if (!ink[x]) continue
    const last = clusters.at(-1)
    if (last && x - last.end <= gap) {
      last.end = x + 1
      last.ink += ink[x]
    } else clusters.push({ start: x, end: x + 1, ink: ink[x] })
  }
  const most = Math.max(0, ...clusters.map((c) => c.ink))
  const text = clusters.filter((c) => c.ink >= most * 0.05)
  if (!text.length) return line
  const pad = 16
  const from = Math.max(0, text[0].start - pad)
  const to = Math.min(width, text[text.length - 1].end + pad)
  const out = document.createElement('canvas')
  out.width = to - from
  out.height = height
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(line, from, 0, to - from, height, 0, 0, to - from, height)
  return out
}

/** A slice of a row strip, between two fractions of its width, with a white margin. */
function slice(strip: HTMLCanvasElement, from: number, to: number) {
  const x = Math.round(strip.width * from)
  const w = Math.round(strip.width * to) - x
  const pad = 12
  const out = document.createElement('canvas')
  out.width = w + pad * 2
  out.height = strip.height
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(strip, x, 0, w, strip.height, pad, 0, w, strip.height)
  return out
}

/** Shrinks a score box to the area inside its yellow edge, where the digits are. */
function inside(box: Rect): Rect {
  return { x: box.x + box.w * 0.12, y: box.y + box.h * 0.1, w: box.w * 0.76, h: box.h * 0.8 }
}

export function parseGoals(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '')
  if (!digits || digits.length > 2) return null
  return Number(digits)
}

export function cleanName(text: string): string | null {
  const name = text
    .replace(/\s+/g, ' ')
    .replace(/^[\s|_.,:;'"`~\-—=]+|[\s|_.,:;'"`~\-—=]+$/g, '')
    .trim()
  return name.length >= 2 && name.length <= 40 ? name : null
}

/** What OCR returned for one piece of the screenshot, with its confidence from 0 to 100. */
export type Reading = { text: string; confidence: number }
/** One row of the stats table, read whole and as the two number columns on their own. */
export type StatRow = { row: Reading; home: Reading; away: Reading }

function toNumber(text: string): number | null {
  const digits = text.replace(/[\s%]/g, '')
  return /^\d{1,4}$/.test(digits) ? Number(digits) : null
}

/**
 * Settles one number from two readings. Both readings come from the same pixels, so a
 * number is kept only when they agree, or when one is unreadable and the other is very sure.
 */
function settle(fromRow: number | null, rowConfidence: number, column: Reading): number | null {
  const fromColumn = toNumber(column.text)
  if (fromRow != null && fromColumn != null) {
    return fromRow === fromColumn && Math.max(rowConfidence, column.confidence) >= 85 ? fromRow : null
  }
  if (fromRow != null) return rowConfidence >= 90 ? fromRow : null
  if (fromColumn != null) return column.confidence >= 90 ? fromColumn : null
  return null
}

/** Other wordings the game uses for some stats. */
const LABEL_ALIASES: [StatKey, string][] = [['shots', 'Total Shots']]

/** Turns the rows of the stats table into numbers, keeping only rows that make sense. */
export function parseStats(rows: StatRow[]): MatchStats {
  const stats: MatchStats = {}
  const labels = [...(Object.entries(STAT_LABELS) as [StatKey, string][]), ...LABEL_ALIASES]
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  for (const { row, home, away } of rows) {
    const tokens = row.text.trim().split(/\s+/).filter(Boolean)
    const label = letters(tokens.slice(1, -1).join(''))
    if (tokens.length < 3 || !label) continue
    let best: StatKey | null = null
    let bestScore = 0.75
    for (const [key, name] of labels) {
      const score = similarity(label, letters(name))
      if (score > bestScore) {
        best = key
        bestScore = score
      }
    }
    if (!best || stats[best]) continue
    const h = settle(toNumber(tokens[0]), row.confidence, home)
    const a = settle(toNumber(tokens[tokens.length - 1]), row.confidence, away)
    if (h != null && a != null) stats[best] = [h, a]
  }

  const possession = stats.possession
  if (possession && Math.abs(possession[0] + possession[1] - 100) > 2) delete stats.possession
  const pairs: [StatKey, StatKey][] = [
    ['shots_on_target', 'shots'],
    ['successful_passes', 'passes'],
  ]
  for (const [part, whole] of pairs) {
    const a = stats[part]
    const b = stats[whole]
    if (a && b && (a[0] > b[0] || a[1] > b[1])) delete stats[part]
  }
  return stats
}

/** Screenshots smaller than this (in height of the game's 16:9 area) are too blurry for the stats table. */
const MIN_STATS_HEIGHT = 540

/** The OCR engine files are served by this site (see vite.config.ts) rather than a public CDN. */
const ENGINE = { workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', workerBlobURL: false }
const ENGINE_TIMEOUT = 60_000

/** Thrown when the OCR engine can't be loaded, for example on a bad connection. */
export class ReaderUnavailableError extends Error {}

type OcrWorker = Awaited<ReturnType<typeof import('tesseract.js').createWorker>>

async function startEngine(): Promise<{ worker: OcrWorker; PSM: typeof import('tesseract.js').PSM }> {
  try {
    const { createWorker, PSM } = await import('tesseract.js')
    const starting = createWorker('eng', 1, ENGINE)
    const worker = await new Promise<OcrWorker>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('The OCR engine took too long to load'))
        void starting.then((w) => w.terminate()).catch(() => undefined)
      }, ENGINE_TIMEOUT)
      starting.then(
        (w) => {
          clearTimeout(timer)
          resolve(w)
        },
        (e: unknown) => {
          clearTimeout(timer)
          reject(e instanceof Error ? e : new Error(String(e)))
        },
      )
    })
    return { worker, PSM }
  } catch (e) {
    console.warn('Screenshot reader:', e)
    const message = e instanceof Error ? e.message : String(e)
    throw new ReaderUnavailableError(message && message !== 'undefined' ? message : "The reader's files didn't download")
  }
}

/**
 * Reads a full-time screenshot; returns null when it doesn't look like one or the score
 * can't be read, and throws ReaderUnavailableError when the OCR engine can't be loaded.
 * `onScore` gets the names and score as soon as they are read, before the slower stats table.
 */
export async function readResultScreenshot(file: Blob, onScore?: (reading: ScreenshotReading) => void): Promise<ScreenshotReading | null> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const layout = findLayout(img)
  if (!layout) return null

  const { worker, PSM } = await startEngine()
  try {
    const recognise = async (image: HTMLCanvasElement): Promise<Reading> => {
      const { text, confidence } = (await worker.recognize(image)).data
      return { text, confidence }
    }
    const read = (rect: Rect, isInk: Rgb) => recognise(inkCanvas(canvas, rect, layout.scale, isInk))

    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789' })
    const goals = async (box: Rect) => {
      const r = await read(inside(box), isDark)
      return r.confidence >= 60 ? parseGoals(r.text) : null
    }
    const homeGoals = await goals(layout.homeBox)
    const awayGoals = await goals(layout.awayBox)
    if (homeGoals == null || awayGoals == null) return null

    await worker.setParameters({ tessedit_char_whitelist: '' })
    const name = async (rect: Rect) => {
      const r = await recognise(trimToText(inkCanvas(canvas, rect, layout.scale, isYellow)))
      return r.confidence >= 50 ? cleanName(r.text) : null
    }
    const reading: ScreenshotReading = { homeName: await name(layout.homeName), awayName: await name(layout.awayName), homeGoals, awayGoals, stats: {} }
    onScore?.(reading)
    if (1100 / layout.scale < MIN_STATS_HEIGHT) return reading

    // Each row is read whole, then its two number columns are read again limited to digits.
    const strips = splitRows(inkCanvas(canvas, layout.table, layout.scale, isYellow, true))
    const rows: StatRow[] = []
    for (const strip of strips) rows.push({ row: await recognise(strip), home: { text: '', confidence: 0 }, away: { text: '', confidence: 0 } })
    await worker.setParameters({ tessedit_char_whitelist: '0123456789%' })
    for (const [i, strip] of strips.entries()) {
      rows[i].home = await recognise(slice(strip, 0, 0.27))
      rows[i].away = await recognise(slice(strip, 0.73, 1))
    }
    return { ...reading, stats: parseStats(rows) }
  } finally {
    await worker.terminate()
  }
}
