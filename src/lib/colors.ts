// Player identity colours, assigned in the order players joined so a player
// keeps the same colour everywhere (avatars, head-to-head bars).
export const PLAYER_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** White or near-black, whichever reads better on `hex`. */
export function inkOn(hex: string): string {
  const l = luminance(hex)
  const onWhite = 1.05 / (l + 0.05)
  const onDark = (l + 0.05) / (luminance('#0b1020') + 0.05)
  return onWhite >= onDark ? '#ffffff' : '#0b1020'
}
