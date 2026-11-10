import { Component, type ReactNode } from 'react'
import { reloadOnce } from '../lib/reload'
import { ErrorState } from './ui'

/** What browsers say when a page's code file can't be downloaded. */
const DOWNLOAD_FAILED = /dynamically imported module|importing a module script failed|error loading dynamically imported/i

/**
 * Catches a page that fails to draw, so the rest of the app (header, menu) keeps working.
 * A page whose code didn't download (usually right after an update) gets one automatic reload.
 */
export class PageBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e))
    return { error: DOWNLOAD_FAILED.test(error.message) ? new Error("This page didn't download. Check your connection and try again.") : error }
  }

  componentDidCatch(e: unknown) {
    if (e instanceof Error && DOWNLOAD_FAILED.test(e.message)) reloadOnce()
  }

  render() {
    if (this.state.error) return <ErrorState error={this.state.error} onRetry={() => window.location.reload()} />
    return this.props.children
  }
}
