import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { friendlyError } from '../lib/api'
import { api } from '../lib/backend'
import { makeFigure, type Figure } from '../lib/cutout'
import { keys, type League } from '../lib/queries'
import { buildTable, type Row } from '../lib/stats'
import type { Player } from '../lib/types'
import { CollectibleCard } from './Potw'
import { useToast } from './Toast'
import { Button, Sheet, Toggle, buttonClass } from './ui'

const emptyRow = (playerId: string): Row => ({
  playerId,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  cleanSheets: 0,
  points: 0,
  winPct: 0,
  form: [],
  qualified: true,
  gamesNeeded: 0,
})

/** Upload the cut-out figure shown on a player's Player of the Week cards. */
export function CardFigureEditor({ open, onClose, league, player, self }: { open: boolean; onClose: () => void; league: League; player: Player; self: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [removeBg, setRemoveBg] = useState(true)
  const [figure, setFigure] = useState<Figure | null>(null)
  const [working, setWorking] = useState(false)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewRow = useMemo(
    () => buildTable(league.matches, league.settings).find((r) => r.playerId === player.id) ?? emptyRow(player.id),
    [league, player.id],
  )

  useEffect(() => {
    if (!open) {
      setFile(null)
      setFigure(null)
      setError(null)
      setRemoveBg(true)
    }
  }, [open])
  useEffect(() => () => {
    if (figure) URL.revokeObjectURL(figure.url)
  }, [figure])

  async function prepare(f: File, remove: boolean) {
    setWorking(true)
    setError(null)
    try {
      const made = await makeFigure(f, remove)
      setFigure(made)
      if (made.alreadyCutOut) setRemoveBg(false)
    } catch (e) {
      setFigure(null)
      setError(friendlyError(e))
    } finally {
      setWorking(false)
    }
  }

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFile(f)
    void prepare(f, removeBg)
  }

  async function apply(next: Blob | null) {
    setBusy(next ? 'save' : 'remove')
    try {
      await api.setCardFigure(player, next, self)
      await Promise.all([qc.invalidateQueries({ queryKey: keys.players }), qc.invalidateQueries({ queryKey: ['me'] })])
      toast.success(next ? 'Card figure saved' : 'Card figure removed')
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={self ? 'Your card figure' : `${player.name}'s card figure`}>
      <div className="space-y-4">
        <div className="relative mx-auto w-44">
          <CollectibleCard league={league} row={previewRow} caption="Player of the week" mini figureUrl={figure ? figure.url : undefined} />
          {working && (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/60 text-center text-xs font-semibold text-white">
              <div>
                <LoaderCircle className="mx-auto mb-2 h-7 w-7 animate-spin" aria-hidden />
                {removeBg ? 'Cutting out…' : 'Preparing…'}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted">
          Shown on your Player of the Week cards, like an eFootball card. Best: a photo from the waist up, facing the camera, against a
          plain background. Celebration poses look great.
        </p>

        <label className={buttonClass(figure ? 'secondary' : 'primary', 'lg', 'w-full')}>
          <ImagePlus className="h-5 w-5" aria-hidden />
          {figure ? 'Choose another photo' : 'Choose a photo'}
          <input type="file" accept="image/*" className="sr-only" onChange={pick} disabled={working} />
        </label>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.04] p-3">
          <div>
            <div className="text-sm font-semibold">Remove the background</div>
            <div className="text-xs text-muted">
              AI cut-out that runs on your device. The first time downloads about 10 MB. Already have a cut-out PNG? Turn this off.
            </div>
          </div>
          <Toggle
            checked={removeBg}
            onChange={(v) => {
              setRemoveBg(v)
              if (file) void prepare(file, v)
            }}
            label="Remove the background"
          />
        </div>

        {error && <p className="rounded-xl border border-loss/40 bg-[#2a1216] px-3.5 py-2.5 text-sm text-[#ffd0d0]">{error}</p>}

        {figure && (
          <Button variant="primary" size="lg" className="w-full" loading={busy === 'save'} disabled={working} onClick={() => void apply(figure.blob)}>
            Save card figure
          </Button>
        )}
        {!figure && player.card_url && (
          <Button variant="ghost" className="w-full" loading={busy === 'remove'} onClick={() => void apply(null)}>
            Remove card figure
          </Button>
        )}
      </div>
    </Sheet>
  )
}
