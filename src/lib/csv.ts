import type { Match } from './types'
import { clockTime, dayKey } from './time'

function cell(value: string | number | null | undefined): string {
  let s = value == null ? '' : String(value)
  // Stop spreadsheet apps from treating text like "=SUM(...)" as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function matchesToCsv(
  matches: Match[],
  nameOf: (id: string) => string,
  tz: string,
  imageUrl: (path: string | null) => string | null,
): string {
  const header = [
    'date',
    'time',
    'home',
    'away',
    'home_goals',
    'away_goals',
    'penalties_winner',
    'home_team',
    'away_team',
    'status',
    'notes',
    'logged_by',
    'screenshot',
  ]
  const lines = matches.map((m) =>
    [
      dayKey(m.played_at, tz),
      clockTime(m.played_at, tz),
      nameOf(m.home_id),
      nameOf(m.away_id),
      m.home_goals,
      m.away_goals,
      m.pens_winner_id ? nameOf(m.pens_winner_id) : '',
      m.home_team,
      m.away_team,
      m.status,
      m.notes,
      m.submitted_by ? nameOf(m.submitted_by) : '',
      imageUrl(m.screenshot_path),
    ]
      .map(cell)
      .join(','),
  )
  return [header.join(','), ...lines].join('\r\n')
}

export function downloadFile(filename: string, contents: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿', contents], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
