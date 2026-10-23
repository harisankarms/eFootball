// Turns a photo into an eFootball-card style cut-out figure, entirely in the browser.
// The person is found with Google's MediaPipe selfie segmentation model, so no photo
// is sent anywhere. The library (and its ~10 MB engine) only loads when it's used.
import type { ImageSegmenter } from '@mediapipe/tasks-vision'

// Must match the @mediapipe/tasks-vision version in package.json.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

const MAX_INPUT_SIDE = 1024
const MAX_WIDTH = 640
const MAX_HEIGHT = 800

let segmenter: Promise<ImageSegmenter> | null = null

function loadSegmenter() {
  segmenter ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
  })().catch((e) => {
    segmenter = null
    throw e
  })
  return segmenter
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Your browser could not process the image.')
  return { canvas, ctx }
}

async function loadImage(file: File): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => {
      throw new Error('Could not read that image. Try a PNG or JPG.')
    })
    const scale = Math.min(1, MAX_INPUT_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const { canvas, ctx } = canvas2d(Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale))
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** True when a good share of the image is already see-through (a ready-made cut-out). */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  let clear = 0
  for (let i = 3; i < data.length; i += 16) if (data[i] < 200) clear++
  return clear / (data.length / 16) > 0.05
}

/** Keeps the person and makes the background transparent. */
async function cutOutPerson(source: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const model = await loadSegmenter()
  const result = model.segment(source)
  try {
    const masks = result.confidenceMasks ?? []
    const mask = masks[masks.length - 1]
    if (!mask) throw new Error('Could not find a person in that photo.')
    const { width, height } = mask
    const person = mask.getAsFloat32Array()

    // Some model versions output background confidence instead: if the middle looks like
    // background and the edges look like a person, flip it.
    let centre = 0
    let edge = 0
    for (let y = 0; y < height; y += 8) {
      for (let x = 0; x < width; x += 8) {
        const v = person[y * width + x]
        const inMiddle = Math.abs(x - width / 2) < width / 6 && Math.abs(y - height / 2) < height / 6
        const onEdge = x < width * 0.05 || x > width * 0.95 || y < height * 0.05
        if (inMiddle) centre += v
        else if (onEdge) edge += v
      }
    }
    const flip = centre < edge

    const { canvas, ctx } = canvas2d(width, height)
    ctx.drawImage(source, 0, 0, width, height)
    const pixels = ctx.getImageData(0, 0, width, height)
    let kept = 0
    for (let i = 0; i < width * height; i++) {
      const p = flip ? 1 - person[i] : person[i]
      // Soft edge between 0.35 and 0.75 confidence.
      const alpha = Math.min(1, Math.max(0, (p - 0.35) / 0.4))
      if (alpha > 0.5) kept++
      pixels.data[i * 4 + 3] = Math.round(pixels.data[i * 4 + 3] * alpha)
    }
    if (kept < width * height * 0.02) throw new Error('Could not find a person in that photo. Try one where you fill more of the frame.')
    ctx.putImageData(pixels, 0, 0)
    return canvas
  } finally {
    result.close()
  }
}

/** Crops away fully transparent edges, keeping a little breathing room. */
function trim(source: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = source
  const { data } = source.getContext('2d')!.getImageData(0, 0, width, height)
  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  if (right < 0) throw new Error('The cut-out came out empty. Try another photo.')
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.03)
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  right = Math.min(width - 1, right + pad)
  // The bottom is left flush so the figure rises from the bottom of the card.
  const w = right - left + 1
  const h = bottom - top + 1
  const scale = Math.min(1, MAX_WIDTH / w, MAX_HEIGHT / h)
  const { canvas, ctx } = canvas2d(Math.round(w * scale), Math.round(h * scale))
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, left, top, w, h, 0, 0, canvas.width, canvas.height)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** WebP keeps transparency and is small; browsers that can't make WebP get PNG. */
async function encodeWithAlpha(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp', 0.86)
  if (webp && webp.type === 'image/webp') return webp
  const png = await toBlob(canvas, 'image/png')
  if (!png) throw new Error('Your browser could not process the image.')
  return png
}

export type Figure = { blob: Blob; url: string; alreadyCutOut: boolean }

/**
 * Prepares a card figure from a photo. With `removeBackground` the person is cut out;
 * images that are already transparent (for example from a phone's "lift subject") are kept as they are.
 */
export async function makeFigure(file: File, removeBackground: boolean): Promise<Figure> {
  const source = await loadImage(file)
  const alreadyCutOut = hasTransparency(source)
  const cut = removeBackground && !alreadyCutOut ? await cutOutPerson(source) : source
  const blob = await encodeWithAlpha(trim(cut))
  return { blob, url: URL.createObjectURL(blob), alreadyCutOut }
}
