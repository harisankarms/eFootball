import type { Outcome } from '../lib/stats'

const styles: Record<Outcome, string> = {
  W: 'bg-win text-[#03140a]',
  D: 'bg-draw text-white',
  L: 'bg-loss text-white',
}
const words: Record<Outcome, string> = { W: 'Won', D: 'Drew', L: 'Lost' }

export function FormChips({ form, size = 'sm' }: { form: Outcome[]; size?: 'xs' | 'sm' | 'md' }) {
  if (!form.length) return null
  const dims = size === 'xs' ? 'h-4 w-4 text-[9px] rounded' : size === 'md' ? 'h-7 w-7 text-xs rounded-lg' : 'h-5 w-5 text-[10px] rounded-md'
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`Form, oldest to newest: ${form.map((o) => words[o]).join(', ')}`}>
      {form.map((o, i) => (
        <span key={i} className={`grid place-items-center font-bold ${dims} ${styles[o]}`}>
          {o}
        </span>
      ))}
    </span>
  )
}
