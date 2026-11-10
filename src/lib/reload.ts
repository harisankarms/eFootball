const KEY = 'eft-reloaded-at'

/**
 * Reloads the page, unless it already did so in the last 30 seconds (then reloading isn't
 * helping, and the caller should show an error instead). Returns whether it's reloading.
 */
export function reloadOnce(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 30_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
