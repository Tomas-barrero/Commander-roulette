import { useEffect, useState } from 'react'
import { CHALLENGES_BY_ID } from '../challenges/definitions'
import type { ChallengeRun, PoolCheck } from '../challenges/engine'
import { CATEGORIES } from '../challenges/types'
import type { ScryfallCard } from '../scryfall/types'
import { TypeBadge } from './ChallengeSettings'
import { Skulls } from './controls'

const frontImage = (card: ScryfallCard, size: 'normal' | 'png') =>
  (card.image_uris ?? card.card_faces?.[0]?.image_uris)?.[size]

const scryfallSearch = (query: string) => `https://scryfall.com/search?q=${encodeURIComponent(query)}`

function PoolBadge({ pool, label = 'Pool' }: { pool: PoolCheck; label?: string }) {
  const styles = {
    ok: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
    tight: 'border-amber-600 bg-amber-950/60 text-amber-200',
    'too-small': 'border-red-700 bg-red-950/60 text-red-200',
  }[pool.level]
  const icon = { ok: '✓', tight: '⚠', 'too-small': '✗' }[pool.level]
  const note = pool.level === 'ok' ? '' : pool.level === 'tight' ? ' (tight)' : `, need ${pool.needed}`
  return (
    <a
      href={scryfallSearch(pool.query)}
      target="_blank"
      rel="noreferrer"
      title={`${pool.query}\n\nOpen this pool on Scryfall`}
      className={`inline-block rounded border px-2 py-0.5 text-xs whitespace-nowrap hover:brightness-125 ${styles}`}
    >
      {icon} {label}: {pool.count.toLocaleString()} cards{note}
    </a>
  )
}

function CardLightbox({ card, onClose }: { card: ScryfallCard; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-label={card.name}>
      <div className="flex max-h-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img src={frontImage(card, 'png')} alt={card.name} className="max-h-[80vh] w-auto max-w-full object-contain" />
        <div className="flex gap-4 text-sm">
          <a href={card.scryfall_uri} target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">
            View on Scryfall ↗
          </a>
          <button type="button" onClick={onClose} className="text-stone-300 hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  run: ChallengeRun
  busy: boolean
  onReroll: (id: string) => void
  onDisable: (id: string) => void
}

export function ChallengeList({ run, busy, onReroll, onDisable }: Props) {
  const [enlarged, setEnlarged] = useState<ScryfallCard>()

  return (
    <section className="rounded-xl border border-amber-400/30 bg-stone-900/80 p-5 shadow-xl">
      <h2 className="mb-4 font-serif text-xl font-semibold text-amber-100">Your challenge</h2>
      <ul className="space-y-4">
        {run.outcomes.map((o) => {
          const def = CHALLENGES_BY_ID[o.id]
          if (!def) return null
          const icon = CATEGORIES.find((c) => c.id === def.category)?.icon
          const problem = o.skipped ?? o.error
          const tooSmall = o.pool?.level === 'too-small'
          return (
            <li key={o.id} className={`space-y-2 ${problem ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden>{icon}</span>
                <span className="font-medium text-stone-100">{def.name}</span>
                <Skulls difficulty={def.difficulty} />
                <TypeBadge type={def.type} />
                {o.pool && <PoolBadge pool={o.pool} />}
                {def.generate && !o.skipped && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReroll(o.id)}
                    className="ml-auto rounded border border-stone-600 px-2 py-0.5 text-xs text-stone-300 hover:border-amber-300 hover:text-amber-100 disabled:opacity-40"
                  >
                    🎲 Reroll this
                  </button>
                )}
              </div>
              <p className="text-stone-300">{problem ? `Skipped: ${problem}` : o.summary}</p>
              {tooSmall && (
                <p className="text-sm text-red-300">
                  Not enough Arena cards in your colours to build this.{' '}
                  {def.generate ? 'Reroll it, or ' : ''}
                  <button type="button" disabled={busy} onClick={() => onDisable(o.id)} className="underline hover:text-white">
                    turn it off
                  </button>
                  .
                </p>
              )}
              {o.generated?.cards && (
                <div className="flex flex-wrap gap-3">
                  {o.generated.cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setEnlarged(card)}
                      title={`${card.name} (click to enlarge)`}
                      className="w-28 transition hover:-translate-y-1 sm:w-32"
                    >
                      <img src={frontImage(card, 'normal')} alt={card.name} loading="lazy" className="h-auto w-full" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {run.combined && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-700 pt-4 text-sm text-stone-300">
          All your nonland rules together: <PoolBadge pool={run.combined} label="Combined pool" />
          {run.combined.level === 'too-small' && <span className="text-red-300">Too few cards. Turn something off.</span>}
        </div>
      )}

      {enlarged && <CardLightbox card={enlarged} onClose={() => setEnlarged(undefined)} />}
    </section>
  )
}
