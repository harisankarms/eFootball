import { describe, expect, it } from 'vitest'
import {
  addMonths,
  clockTime,
  dayHeading,
  dayKey,
  durationLabel,
  monthKey,
  relativeTime,
  safeTimeZone,
  startOfDay,
  weekKey,
  weekLabel,
} from './time'

const IST = 'Asia/Kolkata'

describe('weeks in the group timezone', () => {
  it('puts a late Sunday-night UTC match into the next week in India', () => {
    // 20:00 UTC Sunday = 01:30 Monday in India
    expect(weekKey('2026-10-25T20:00:00Z', IST)).toBe('2026-10-26')
    expect(weekKey('2026-10-25T20:00:00Z', 'UTC')).toBe('2026-10-19')
  })

  it('keeps 23:59 Sunday in the week that started on Monday', () => {
    expect(weekKey('2026-10-25T18:29:00Z', IST)).toBe('2026-10-19')
    expect(weekKey('2026-10-25T18:30:00Z', IST)).toBe('2026-10-26')
  })

  it('handles weeks that cross a month and a year', () => {
    expect(weekKey('2027-01-01T12:00:00Z', IST)).toBe('2026-12-28')
    expect(weekLabel('2026-10-19')).toBe('19–25 Oct')
    expect(weekLabel('2026-10-26')).toBe('26 Oct – 1 Nov')
  })

  it('computes months and month arithmetic', () => {
    expect(monthKey('2026-10-31T19:00:00Z', IST)).toBe('2026-11')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

describe('start of day', () => {
  it('finds midnight in India', () => {
    expect(startOfDay('2026-10-26', IST).toISOString()).toBe('2026-10-25T18:30:00.000Z')
  })

  it('survives daylight saving changes', () => {
    expect(startOfDay('2026-03-29', 'Europe/London').toISOString()).toBe('2026-03-29T00:00:00.000Z')
    expect(startOfDay('2026-03-30', 'Europe/London').toISOString()).toBe('2026-03-29T23:00:00.000Z')
    expect(startOfDay('2026-11-02', 'America/New_York').toISOString()).toBe('2026-11-02T05:00:00.000Z')
  })
})

describe('labels', () => {
  it('formats clock time', () => {
    expect(clockTime('2026-10-23T16:11:00Z', IST)).toBe('9:41 pm')
    expect(clockTime('2026-10-22T18:35:00Z', IST)).toBe('12:05 am')
  })

  it('names days relative to today', () => {
    expect(dayHeading('2026-10-23', '2026-10-23')).toBe('Today')
    expect(dayHeading('2026-10-22', '2026-10-23')).toBe('Yesterday')
    expect(dayHeading('2026-10-19', '2026-10-23')).toBe('Monday 19 Oct')
    expect(dayHeading('2025-12-31', '2026-10-23')).toBe('Wednesday 31 Dec 2025')
  })

  it('describes how long ago something happened', () => {
    const now = new Date('2026-10-23T16:00:00Z') // 21:30 in India
    expect(relativeTime('2026-10-23T15:59:40Z', IST, now)).toBe('just now')
    expect(relativeTime('2026-10-23T15:15:00Z', IST, now)).toBe('45m ago')
    expect(relativeTime('2026-10-23T10:00:00Z', IST, now)).toBe('6h ago')
    expect(relativeTime('2026-10-22T10:00:00Z', IST, now)).toBe('Yesterday')
    expect(relativeTime('2026-10-19T10:00:00Z', IST, now)).toBe('Mon 19 Oct')
  })

  it('formats countdowns', () => {
    expect(durationLabel((3 * 24 + 4) * 3600_000 + 59_000)).toBe('3d 4h')
    expect(durationLabel(5 * 3600_000 + 12 * 60_000)).toBe('5h 12m')
    expect(durationLabel(12 * 60_000)).toBe('12m')
    expect(durationLabel(-5)).toBe('0m')
  })

  it('falls back to UTC for an unknown timezone', () => {
    expect(safeTimeZone('Mars/Olympus')).toBe('UTC')
    expect(safeTimeZone(IST)).toBe(IST)
    expect(dayKey('2026-10-23T00:00:00Z', safeTimeZone('nope'))).toBe('2026-10-23')
  })
})
