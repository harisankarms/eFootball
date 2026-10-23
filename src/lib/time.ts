// Date helpers. Weeks run Monday to Sunday in the group's timezone, so
// "this week" is the same for every friend no matter where their phone is set.
// Calendar days are passed around as 'YYYY-MM-DD' keys and months as 'YYYY-MM'.

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

export function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

function partsIn(date: Date, tz: string): Parts {
  let f = partsFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    partsFormatters.set(tz, f)
  }
  const out: Record<string, number> = {}
  for (const p of f.formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  return out as Parts
}

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const splitKey = (key: string) => key.split('-').map(Number)

export function dayKey(date: Date | string, tz: string): string {
  const p = partsIn(new Date(date), tz)
  return toKey(p.year, p.month, p.day)
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = splitKey(key)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return toKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayOf(key: string): number {
  const [y, m, d] = splitKey(key)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** The Monday that starts the week containing `date`. */
export function weekKey(date: Date | string, tz: string): string {
  const day = dayKey(date, tz)
  return addDays(day, -weekdayOf(day))
}

export function monthKey(date: Date | string, tz: string): string {
  return dayKey(date, tz).slice(0, 7)
}

export function addMonths(key: string, n: number): string {
  const [y, m] = splitKey(key)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** "20–26 Oct" or "27 Oct – 2 Nov" */
export function weekLabel(key: string): string {
  const end = addDays(key, 6)
  const [, sm, sd] = splitKey(key)
  const [, em, ed] = splitKey(end)
  return sm === em ? `${sd}–${ed} ${MONTHS[sm - 1]}` : `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}`
}

/** "October 2026" */
export function monthLabel(key: string): string {
  const [y, m] = splitKey(key)
  return `${MONTHS_LONG[m - 1]} ${y}`
}

/** "Today", "Yesterday", or "Monday 20 Oct" (with the year when it isn't this year). */
export function dayHeading(key: string, todayKey: string): string {
  if (key === todayKey) return 'Today'
  if (key === addDays(todayKey, -1)) return 'Yesterday'
  const [y, m, d] = splitKey(key)
  const year = y === splitKey(todayKey)[0] ? '' : ` ${y}`
  return `${WEEKDAYS_LONG[weekdayOf(key)]} ${d} ${MONTHS[m - 1]}${year}`
}

/** "Mon 20 Oct" */
export function shortDate(date: Date | string, tz: string): string {
  const key = dayKey(date, tz)
  const [, m, d] = splitKey(key)
  return `${WEEKDAYS_LONG[weekdayOf(key)].slice(0, 3)} ${d} ${MONTHS[m - 1]}`
}

/** "20 Oct 2026" */
export function longDate(date: Date | string, tz: string): string {
  const [y, m, d] = splitKey(dayKey(date, tz))
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "9:41 pm" */
export function clockTime(date: Date | string, tz: string): string {
  const p = partsIn(new Date(date), tz)
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12
  return `${h}:${pad(p.minute)} ${p.hour < 12 ? 'am' : 'pm'}`
}

/** "just now", "5m ago", "3h ago", "Yesterday", "Mon 20 Oct" */
export function relativeTime(date: Date | string, tz: string, now: Date = new Date()): string {
  const then = new Date(date)
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const today = dayKey(now, tz)
  const day = dayKey(then, tz)
  if (day === today) return `${Math.floor(mins / 60)}h ago`
  if (day === addDays(today, -1)) return 'Yesterday'
  return shortDate(then, tz)
}

function offsetMs(date: Date, tz: string): number {
  const p = partsIn(date, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - (date.getTime() - date.getUTCMilliseconds())
}

/** The instant a calendar day begins in `tz`. */
export function startOfDay(key: string, tz: string): Date {
  const [y, m, d] = splitKey(key)
  const guess = Date.UTC(y, m - 1, d)
  let ts = guess - offsetMs(new Date(guess), tz)
  ts = guess - offsetMs(new Date(ts), tz)
  return new Date(ts)
}

/** "3d 4h", "5h 12m", "12m" */
export function durationLabel(ms: number): string {
  const totalMins = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/** Value for an <input type="datetime-local"> in the device's own timezone. */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
