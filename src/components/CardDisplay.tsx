import { useState } from 'react'
import type { ScryfallCard } from '../scryfall/types'

/** Images for each side: one for normal cards, one per face for double-faced cards. */
function cardImages(card: ScryfallCard): { src: string; name: string }[] {
  if (card.image_uris) return [{ src: card.image_uris.png, name: card.name }]
  return (card.card_faces ?? [])
    .filter((f) => f.image_uris)
    .map((f) => ({ src: f.image_uris!.png, name: f.name }))
}

/** The full, unaltered card image, with a flip button for double-faced cards. */
export function CardDisplay({ card }: { card: ScryfallCard }) {
  const images = cardImages(card)
  const [face, setFace] = useState(0)
  const current = images[face] ?? images[0]

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-3">
      {/* The PNG has transparent rounded corners, so nothing is cropped. */}
      <div className="aspect-[745/1040] w-full">
        {current && (
          <img
            key={current.src}
            src={current.src}
            alt={current.name}
            className="animate-card-in h-full w-full object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
          />
        )}
      </div>
      {images.length > 1 && (
        <button
          type="button"
          onClick={() => setFace((face + 1) % images.length)}
          className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-200 transition hover:border-amber-300 hover:text-amber-100"
        >
          ↻ Flip to {images[(face + 1) % images.length].name}
        </button>
      )}
    </div>
  )
}
