import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, LoaderCircle, Megaphone, Trash, X } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { compressScreenshot } from '../lib/image'
import { keys, useAuth, useNow, type League } from '../lib/queries'
import { relativeTime } from '../lib/time'
import type { Announcement, Shot } from '../lib/types'
import { Avatar } from './Avatar'
import { Lightbox } from './Lightbox'
import { useToast } from './Toast'
import { Button, Sheet, buttonClass } from './ui'

export function AnnouncementCard({ announcement: a, league }: { announcement: Announcement; league: League }) {
  const qc = useQueryClient()
  const toast = useToast()
  const now = useNow()
  const { me, isAdmin } = useAuth()
  const [zoom, setZoom] = useState(false)
  const full = api.imageUrl(a.image_path)
  const thumb = api.imageUrl(a.thumb_path ?? a.image_path)

  async function remove() {
    if (!window.confirm('Delete this post?')) return
    try {
      await api.deleteAnnouncement(a)
      await qc.invalidateQueries({ queryKey: keys.announcements })
      toast.success('Post deleted')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <article className="card animate-rise p-4">
      <header className="flex items-center gap-3">
        <Avatar league={league} id={a.player_id} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{league.nameOf(a.player_id)}</div>
          <div className="text-xs text-muted">{relativeTime(a.created_at, league.tz, now)}</div>
        </div>
        {(isAdmin || me?.id === a.player_id) && (
          <button
            onClick={() => void remove()}
            aria-label="Delete post"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-ink"
          >
            <Trash className="h-4 w-4" />
          </button>
        )}
      </header>
      <p className="mt-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{a.body}</p>
      {thumb && full && (
        <button onClick={() => setZoom(true)} className="group mt-3 block w-full overflow-hidden rounded-xl border border-line">
          <img src={thumb} alt="Attached screenshot" loading="lazy" className="max-h-80 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        </button>
      )}
      {zoom && full && <Lightbox src={full} onClose={() => setZoom(false)} />}
    </article>
  )
}

export function ComposerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { me } = useAuth()
  const [body, setBody] = useState('')
  const [shot, setShot] = useState<{ data: Shot; preview: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!open) {
      setBody('')
      setShot(null)
    }
  }, [open])
  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.preview)
  }, [shot])

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProcessing(true)
    try {
      const data = await compressScreenshot(file)
      setShot({ data, preview: URL.createObjectURL(data.full) })
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setProcessing(false)
    }
  }

  async function post() {
    if (!me || !body.trim()) return
    setPosting(true)
    try {
      await api.postAnnouncement(body, shot?.data ?? null, me.id)
      await qc.invalidateQueries({ queryKey: keys.announcements })
      toast.success('Posted to the squad')
      onClose()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setPosting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Share with the squad">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void post()
        }}
      >
        <textarea
          className="field min-h-28 resize-none"
          maxLength={500}
          autoFocus
          placeholder="New signing? Tournament this weekend? Trash talk?"
          aria-label="What's happening?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="text-right text-[11px] text-muted tabular-nums">{body.length} / 500</div>
        {shot ? (
          <div className="relative overflow-hidden rounded-xl border border-line">
            <img src={shot.preview} alt="Attached screenshot" className="max-h-56 w-full object-cover" />
            <button
              type="button"
              onClick={() => setShot(null)}
              aria-label="Remove screenshot"
              className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className={buttonClass('secondary', 'md', 'w-full')}>
            {processing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            {processing ? 'Shrinking…' : 'Add a screenshot (optional)'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e)} />
          </label>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={posting} disabled={!body.trim() || processing} icon={<Megaphone className="h-5 w-5" />}>
          Post
        </Button>
      </form>
    </Sheet>
  )
}
