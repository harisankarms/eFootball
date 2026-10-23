import { useEffect, useRef, useState } from 'react'

/** Animates a number from its previous value (0 on first render) up to `target`. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const begin = from.current
    let current = begin
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      current = begin + (target - begin) * (1 - (1 - p) ** 3)
      setValue(current)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      from.current = current
    }
  }, [target, duration])

  return value
}

/** Rounds `value` to as many decimals as `target` has, so 20.5 never shows as 20.4999. */
export function roundLike(value: number, target: number) {
  const decimals = (String(target).split('.')[1] ?? '').length
  return value.toFixed(decimals)
}
