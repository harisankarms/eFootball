// Canvas helpers for the share pictures.

export const W = 1080
export const H = 1350

export const DISPLAY = "'Barlow Condensed', 'Inter Variable', system-ui, sans-serif"
export const SANS = "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif"

export type Ctx = CanvasRenderingContext2D

/** Makes sure the app's fonts are ready before drawing text with them. */
export async function ensureFonts() {
  if (!document.fonts?.load) return
  await Promise.all(
    [`italic 700 80px 'Barlow Condensed'`, `700 80px 'Barlow Condensed'`, `600 80px 'Barlow Condensed'`, `400 40px 'Inter Variable'`, `800 40px 'Inter Variable'`].map(
      (f) => document.fonts.load(f).catch(() => []),
    ),
  )
}

/** Loads a picture so it can be drawn and still exported; null if it can't be (e.g. no CORS). */
export function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img.naturalWidth ? img : null)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** An SVG string as a picture at the given size. */
export function svgImage(markup: string, width: number, height: number): Promise<HTMLImageElement | null> {
  // Set the size on the outer <svg> (replacing any it had) and make sure it says it's SVG.
  const svg = markup.replace(/^<svg\b([^>]*)>/, (_, attrs: string) => {
    const rest = attrs.replace(/\s(width|height|xmlns)="[^"]*"/g, '')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"${rest}>`
  })
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
}

export function newCanvas(width = W, height = H) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("This phone can't draw pictures.")
  return { canvas, ctx }
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the picture."))), 'image/png'),
  )
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** The cards' cut-corner shape. */
export function cardShape(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const cx = w * 0.07
  const cy = h * 0.049
  ctx.beginPath()
  ctx.moveTo(x + cx, y)
  ctx.lineTo(x + w - cx, y)
  ctx.lineTo(x + w, y + cy)
  ctx.lineTo(x + w, y + h - cy)
  ctx.lineTo(x + w - cx, y + h)
  ctx.lineTo(x + cx, y + h)
  ctx.lineTo(x, y + h - cy)
  ctx.lineTo(x, y + cy)
  ctx.closePath()
}

/** Fills the box with the picture, cropping what doesn't fit. */
export function drawCover(ctx: Ctx, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, focusY = 0.5) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) * focusY
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/** Fits the whole picture in the box, standing on its bottom edge. */
export function containBox(img: { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  return { x: x + (w - dw) / 2, y: y + h - dh, w: dw, h: dh }
}

/** Sets the largest font (from `size` down) that keeps `text` within `maxWidth`. */
export function fitFont(ctx: Ctx, text: string, maxWidth: number, size: number, font: (px: number) => string, min = 12) {
  let px = size
  ctx.font = font(px)
  while (px > min && ctx.measureText(text).width > maxWidth) {
    px -= 2
    ctx.font = font(px)
  }
  return px
}

/** Cuts text to fit, with an ellipsis. */
export function clip(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

export function spacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`
}

export function withShadow(ctx: Ctx, color: string, blur: number, draw: () => void, dy = 0) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.shadowOffsetY = dy
  draw()
  ctx.restore()
}

/** A soft round glow. */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, withAlpha(color, alpha))
  g.addColorStop(1, withAlpha(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** '#rrggbb' with an alpha, as rgba(). */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return (words.length === 1 ? words[0][0] : words[0][0] + words[1][0]).toUpperCase()
}

/** A round photo, or initials on the player's colour, with an optional ring. */
export function avatar(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, r: number, color: string, name: string, ring?: string) {
  ctx.save()
  if (ring) {
    ctx.beginPath()
    ctx.arc(x, y, r + r * 0.09, 0, Math.PI * 2)
    ctx.fillStyle = ring
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (img) drawCover(ctx, img, x - r, y - r, r * 2, r * 2, 0.3)
  else {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 0, x, y, r * 1.2)
    g.addColorStop(0, withAlpha('#ffffff', 0.3))
    g.addColorStop(0.55, withAlpha('#ffffff', 0))
    ctx.fillStyle = color
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    ctx.fillStyle = inkOn(color)
    ctx.font = `italic 700 ${Math.round(r * 0.95)}px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initialsOf(name), x, y + r * 0.04)
  }
  ctx.restore()
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16)
  const ch = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255)
}

function inkOn(hex: string) {
  const l = luminance(hex)
  return 1.05 / (l + 0.05) >= (l + 0.05) / (luminance('#0b1020') + 0.05) ? '#ffffff' : '#0b1020'
}
