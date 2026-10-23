import { useQueryClient } from '@tanstack/react-query'
import { Camera, LoaderCircle } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { compressAvatar } from '../lib/image'
import { keys, type League } from '../lib/queries'
import type { Player } from '../lib/types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { Button, Sheet, buttonClass } from './ui'

/** Upload or remove a profile photo. `self` changes your own photo; otherwise an admin changes someone else's. */
export function AvatarEditor({ open, onClose, league, player, self }: { open: boolean; onClose: () => void; league: League; player: Player; self: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)

  useEffect(() => {
    if (!open) setPhoto(null)
  }, [open])
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url)
  }, [photo])

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProcessing(true)
    try {
      const blob = await compressAvatar(file)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setProcessing(false)
    }
  }

  async function apply(next: Blob | null) {
    setBusy(next ? 'save' : 'remove')
    try {
      await api.setAvatar(player, next, self)
      await Promise.all([qc.invalidateQueries({ queryKey: keys.players }), qc.invalidateQueries({ queryKey: ['me'] })])
      toast.success(next ? 'Photo updated' : 'Photo removed')
      onClose()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={self ? 'Your photo' : `${player.name}'s photo`}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          {photo ? (
            <img src={photo.url} alt="New photo" className="h-36 w-36 rounded-full object-cover ring-[3px] ring-accent ring-offset-4 ring-offset-surface" />
          ) : (
            <Avatar league={league} id={player.id} size={144} ring="gradient" />
          )}
          {processing && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
              <LoaderCircle className="h-8 w-8 animate-spin text-white" aria-label="Processing" />
            </span>
          )}
        </div>
        <p className="text-center text-xs text-muted">Square photos look best. It's cropped to a circle and shrunk to save space.</p>
        <div className="flex w-full flex-col gap-2">
          <label className={buttonClass(photo ? 'secondary' : 'primary', 'lg', 'w-full')}>
            <Camera className="h-5 w-5" aria-hidden />
            {photo ? 'Choose another' : 'Choose a photo'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e)} />
          </label>
          {photo && (
            <Button variant="primary" size="lg" className="w-full" loading={busy === 'save'} onClick={() => void apply(photo.blob)}>
              Save photo
            </Button>
          )}
          {!photo && player.avatar_url && (
            <Button variant="ghost" className="w-full" loading={busy === 'remove'} onClick={() => void apply(null)}>
              Remove photo
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
