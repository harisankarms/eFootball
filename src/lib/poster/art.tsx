// Pictures for the share images, made from the same artwork as the cards.
import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ChendaScene } from '../../components/ChendaScene'
import { ClockworkStill } from '../../components/ClockworkScene'
import { EMPTY_TUNNEL, EPIC_TUNNEL, tunnelFrame } from '../../components/epicTunnel'
import { loadImage, svgImage } from './draw'

/** Renders React elements off screen and hands back the markup. */
function markup(node: ReactElement, pick: (root: HTMLElement) => Element | null = (r) => r.firstElementChild): string {
  const box = document.createElement('div')
  const root = createRoot(box)
  flushSync(() => root.render(node))
  const html = pick(box)?.outerHTML ?? ''
  root.unmount()
  return html
}

/** The card's background for each kind, at the given size. */
export async function cardBackground(kind: 'potw' | 'chenda' | 'potm', empty: boolean, w: number, h: number) {
  if (kind === 'potm') return { back: await svgImage(markup(<ClockworkStill />), w, h), front: null }
  if (kind === 'chenda') {
    // Only the still parts: the drum, nettipattam, rays and lights; the flashes are left out.
    const style =
      '<style>.chenda-rays path{fill:#ffb45e;opacity:.08}.chenda-netti{opacity:.9}.chenda-light{fill:#ffd27a}.chenda-glint,.chenda-ember,.chenda-ring,.chenda-ripple,.chenda-burst{display:none}</style>'
    const withStyle = (svg: string) => svg.replace(/^(<svg[^>]*>)/, `$1${style}`)
    const scene = <ChendaScene performer={null} photo={false} />
    const back = markup(scene, (r) => r.querySelector('.chenda-back'))
    const front = markup(scene, (r) => r.querySelector('.chenda-front'))
    return { back: await svgImage(withStyle(back), w, h), front: await svgImage(withStyle(front), w, h) }
  }
  const frame = tunnelFrame(empty ? EMPTY_TUNNEL : EPIC_TUNNEL, w, h)
  return { back: await loadImage(frame), front: null }
}

/** A Lucide icon as a picture. */
export function iconImage(Icon: LucideIcon, color: string, size: number, strokeWidth = 2) {
  return svgImage(markup(<Icon color={color} size={size} strokeWidth={strokeWidth} />), size, size)
}
