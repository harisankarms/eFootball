import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

export type ChartPoint = { x: number; y: number }
export type ChartSeries = { id: string; name: string; color: string; points: ChartPoint[] }

type Props = {
  series: ChartSeries[]
  /** What the chart shows, for screen readers. */
  label: string
  height?: number
  /** A dashed reference line, e.g. the starting rating. */
  baseline?: { y: number; label: string }
  xTicks: (min: number, max: number, count: number) => { x: number; label: string }[]
  formatY: (y: number) => string
  /** What the tooltip says for the point (or moment) under the finger. */
  tooltip: (x: number) => ReactNode
  /** Shade under a single line. */
  area?: boolean
}

const SURFACE = '#0b1229'
const GRID = 'rgb(255 255 255 / 0.07)'
const AXIS_TEXT = '#8090b8'
const LABEL_TEXT = '#b9c3e4'

function niceStep(range: number, count: number) {
  const raw = range / Math.max(1, count)
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow
}

/** The index of the value in sorted `xs` closest to `x`. */
function nearest(xs: number[], x: number) {
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid
    else hi = mid
  }
  return Math.abs(xs[hi] - x) < Math.abs(xs[lo] - x) ? hi : lo
}

/** Spreads labels apart so none overlap, keeping each as close to its line as possible. */
function spread(ys: number[], gap: number, top: number, bottom: number) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap)
  const overflow = order.length ? order[order.length - 1].y - bottom : 0
  if (overflow > 0) for (const o of order) o.y -= overflow
  for (let k = order.length - 2; k >= 0; k--) order[k].y = Math.min(order[k].y, order[k + 1].y - gap)
  for (const o of order) o.y = Math.max(top, o.y)
  const out: number[] = []
  for (const o of order) out[o.i] = o.y
  return out
}

/**
 * A small line chart: thin lines, a quiet grid, one axis. Hover, drag or use the arrow keys to
 * see the values at any point. With several lines, each is named at its end and in the legend.
 */
export function LineChart({ series, label, height = 210, baseline, xTicks, formatY, tooltip, area = false }: Props) {
  const id = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => setWidth(box.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const multi = series.length > 1
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b), [series])

  const geometry = useMemo(() => {
    if (!width || !xs.length) return null
    const all = series.flatMap((s) => s.points.map((p) => p.y))
    if (baseline) all.push(baseline.y)
    let lo = Math.min(...all)
    let hi = Math.max(...all)
    if (hi - lo < 40) {
      const mid = (hi + lo) / 2
      lo = mid - 20
      hi = mid + 20
    }
    const step = niceStep(hi - lo, 4)
    lo = Math.floor(lo / step) * step
    hi = Math.ceil(hi / step) * step
    const yTicks: number[] = []
    for (let v = lo; v <= hi + step / 2; v += step) yTicks.push(v)

    const labelWidth = multi ? Math.max(...series.map((s) => s.name.length)) * 6.6 + 16 : 0
    const left = Math.max(...yTicks.map((v) => formatY(v).length)) * 6.6 + 10
    const right = multi ? Math.min(labelWidth, width * 0.3) : 10
    const top = 10
    const bottom = height - 24
    const x0 = xs[0]
    const x1 = xs[xs.length - 1]
    const px = (x: number) => (x1 === x0 ? (left + width - right) / 2 : left + ((x - x0) / (x1 - x0)) * (width - left - right))
    const py = (y: number) => bottom - ((y - lo) / (hi - lo)) * (bottom - top)
    const ticks = xTicks(x0, x1, Math.max(2, Math.floor((width - left - right) / 90)))
    const ends = series.map((s) => py(s.points[s.points.length - 1]?.y ?? 0))
    const endLabels = multi ? spread(ends, 14, top + 4, bottom - 2) : []
    return { lo, hi, yTicks, left, right, top, bottom, px, py, ticks, endLabels }
  }, [width, xs, series, baseline, multi, height, formatY, xTicks])

  const g = geometry
  const activeX = active != null ? xs[active] : null

  const pick = (e: PointerEvent<SVGRectElement>) => {
    if (!g || !xs.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - rect.left) / rect.width
    const x0 = xs[0]
    const x1 = xs[xs.length - 1]
    setActive(nearest(xs, x0 + fx * (x1 - x0)))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!xs.length) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const d = e.key === 'ArrowRight' ? 1 : -1
      setActive((i) => Math.max(0, Math.min(xs.length - 1, i == null ? (d > 0 ? 0 : xs.length - 1) : i + d)))
    } else if (e.key === 'Escape') setActive(null)
  }

  const tipX = g && activeX != null ? g.px(activeX) : 0
  const tipOnLeft = tipX > width / 2

  return (
    <div>
      {multi && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={boxRef}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        style={{ height }}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        aria-label={`${label}. Use the left and right arrow keys to read the values.`}
      >
        {g && (
          <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible select-none">
            <defs>
              {area &&
                series.map((s) => (
                  <linearGradient key={s.id} id={`${id}${s.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={s.color} stopOpacity="0.22" />
                    <stop offset="1" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                ))}
            </defs>

            {g.yTicks.map((v) => (
              <g key={v}>
                <line x1={g.left} x2={width - g.right} y1={g.py(v)} y2={g.py(v)} stroke={GRID} strokeWidth="1" />
                <text x={g.left - 8} y={g.py(v)} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT} className="tabular-nums">
                  {formatY(v)}
                </text>
              </g>
            ))}
            {g.ticks.map((t) => (
              <text key={t.x} x={g.px(t.x)} y={height - 6} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
                {t.label}
              </text>
            ))}

            {baseline && baseline.y >= g.lo && baseline.y <= g.hi && (
              <g>
                <line
                  x1={g.left}
                  x2={width - g.right}
                  y1={g.py(baseline.y)}
                  y2={g.py(baseline.y)}
                  stroke="rgb(255 255 255 / 0.28)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                {baseline.label && (
                  <text x={width - g.right - 2} y={g.py(baseline.y) - 5} textAnchor="end" fontSize="10.5" fill={AXIS_TEXT}>
                    {baseline.label}
                  </text>
                )}
              </g>
            )}

            {series.map((s) => {
              if (!s.points.length) return null
              const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${g.px(p.x).toFixed(1)} ${g.py(p.y).toFixed(1)}`).join(' ')
              const first = s.points[0]
              const last = s.points[s.points.length - 1]
              return (
                <g key={s.id}>
                  {area && (
                    <path
                      d={`${d} L${g.px(last.x).toFixed(1)} ${g.bottom} L${g.px(first.x).toFixed(1)} ${g.bottom} Z`}
                      fill={`url(#${id}${s.id})`}
                    />
                  )}
                  <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={g.px(last.x)} cy={g.py(last.y)} r="3.5" fill={s.color} stroke={SURFACE} strokeWidth="2" />
                </g>
              )
            })}

            {multi &&
              series.map((s, i) => {
                const last = s.points[s.points.length - 1]
                if (!last) return null
                return (
                  <text key={s.id} x={g.px(last.x) + 8} y={g.endLabels[i]} dy="0.32em" fontSize="11" fontWeight="600" fill={LABEL_TEXT}>
                    {s.name}
                  </text>
                )
              })}

            {activeX != null && (
              <g pointerEvents="none">
                <line x1={tipX} x2={tipX} y1={g.top} y2={g.bottom} stroke="rgb(255 255 255 / 0.35)" strokeWidth="1" />
                {series.map((s) => {
                  const p = s.points.find((q) => q.x === activeX)
                  return p ? <circle key={s.id} cx={tipX} cy={g.py(p.y)} r="5" fill={s.color} stroke={SURFACE} strokeWidth="2" /> : null
                })}
              </g>
            )}

            <rect
              x={g.left}
              y={0}
              width={Math.max(0, width - g.left - g.right)}
              height={height}
              fill="transparent"
              style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
              onPointerDown={pick}
              onPointerMove={pick}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            />
          </svg>
        )}
        {g && activeX != null && (
          <div
            data-chart-tip
            className="pointer-events-none absolute top-1 z-10 max-w-[13rem] rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-[0_12px_30px_-10px_rgb(0_0_0/0.8)] backdrop-blur"
            style={tipOnLeft ? { right: width - tipX + 10 } : { left: tipX + 10 }}
            aria-live="polite"
          >
            {tooltip(activeX)}
          </div>
        )}
      </div>
    </div>
  )
}
