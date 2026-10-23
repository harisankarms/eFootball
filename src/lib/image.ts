import type { Shot } from './types'

// Phone screenshots are 1-3 MB. Shrinking them before upload keeps the free
// 1 GB of storage good for thousands of matches.
const FULL_MAX_SIDE = 1600
const THUMB_MAX_SIDE = 480

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function encode(img: HTMLImageElement, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not process the image.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  // Older Safari can't encode WebP and silently returns a PNG, so check the type.
  const webp = await toBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob(canvas, 'image/jpeg', quality)
  if (!jpeg) throw new Error('Your browser could not process the image.')
  return jpeg
}

export async function compressScreenshot(file: File): Promise<Shot> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => {
      throw new Error('Could not read that image. Try a PNG or JPG screenshot.')
    })
    const full = await encode(img, FULL_MAX_SIDE, 0.82)
    const thumb = await encode(img, THUMB_MAX_SIDE, 0.7)
    return { full, thumb }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
