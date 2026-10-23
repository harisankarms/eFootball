import { useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, Trash } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { keys, useAuth, useComments, useNow, type League } from '../lib/queries'
import { relativeTime } from '../lib/time'
import type { Comment, Match } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { Button, GlowIcon, SectionTitle } from './ui'

const countByMatch = (list: Comment[]) => {
  const counts = new Map<string, number>()
  for (const c of list) counts.set(c.match_id, (counts.get(c.match_id) ?? 0) + 1)
  return counts
}

/** Number of comments per match, for the little speech-bubble counts on match cards. */
export function useCommentCounts() {
  const { data } = useComments()
  return useMemo(() => countByMatch(data ?? []), [data])
}

export function MatchComments({ match, league }: { match: Match; league: League }) {
  const qc = useQueryClient()
  const toast = useToast()
  const now = useNow()
  const { me, isMember, isAdmin, session } = useAuth()
  const { data } = useComments()
  const comments = useMemo(() => (data ?? []).filter((c) => c.match_id === match.id), [data, match.id])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!me || !text.trim()) return
    setSending(true)
    try {
      await api.addComment(match.id, text, me.id)
      setText('')
      await qc.invalidateQueries({ queryKey: keys.comments })
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSending(false)
    }
  }

  async function remove(c: Comment) {
    if (!window.confirm('Delete this comment?')) return
    try {
      await api.deleteComment(c.id)
      await qc.invalidateQueries({ queryKey: keys.comments })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <section>
      <SectionTitle title={comments.length ? `Comments · ${comments.length}` : 'Comments'} />
      <div className="card overflow-hidden">
        {comments.length === 0 ? (
          <div className="flex items-center gap-3 p-4 text-sm text-muted">
            <GlowIcon icon={MessageCircle} tint="cyan" size="sm" />
            No comments yet. Start the banter.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {comments.map((c) => (
              <li key={c.id} className="flex animate-rise gap-3 p-4">
                <Avatar league={league} id={c.player_id} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-semibold">{league.nameOf(c.player_id)}</span>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(c.created_at, league.tz, now)}</span>
                    {(isAdmin || me?.id === c.player_id) && (
                      <button
                        onClick={() => void remove(c)}
                        aria-label="Delete comment"
                        className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-ink"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-[15px] break-words whitespace-pre-wrap text-ink-2">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-white/[0.06] bg-white/[0.02] p-3">
          {isMember && me ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <Avatar league={league} id={me.id} size={32} className="mb-1.5 hidden sm:grid" />
              <textarea
                className="field min-h-11 resize-none py-2.5"
                rows={Math.min(5, Math.max(1, text.split('\n').length))}
                maxLength={500}
                placeholder="Say something…"
                aria-label="Write a comment"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
                }}
              />
              <Button type="submit" variant="primary" className="h-11 w-11 shrink-0 px-0!" loading={sending} disabled={!text.trim()} aria-label="Send comment">
                {!sending && <Send className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <p className="px-1 text-sm text-muted">
              {session ? (
                'Comments are for squad members.'
              ) : (
                <>
                  <Link to="/login" className="font-semibold text-accent hover:underline">
                    Sign in
                  </Link>{' '}
                  to comment.
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
