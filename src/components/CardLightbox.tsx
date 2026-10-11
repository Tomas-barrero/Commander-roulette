import { useEffect } from 'react'
import { frontImage } from '../scryfall/images'
import type { ScryfallCard } from '../scryfall/types'

/** A card shown large over the page, with a link to Scryfall. Click outside or press Escape to close. */
export function CardLightbox({ card, onClose }: { card: ScryfallCard; onClose: () => void }) {
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
