import type { ScryfallCard } from './types'

/** The front face's image (double-faced cards keep their images on the faces). */
export const frontImage = (card: ScryfallCard, size: 'normal' | 'png' = 'normal') =>
  (card.image_uris ?? card.card_faces?.[0]?.image_uris)?.[size]
