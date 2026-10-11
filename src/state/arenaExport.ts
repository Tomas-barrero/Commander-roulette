import type { ScryfallCard } from '../scryfall/types'

/**
 * The name Arena's importer expects. Cards with several faces (double-faced,
 * adventure, split…) use the front face's name, per CLAUDE.md.
 */
export function arenaName(card: ScryfallCard): string {
  return card.card_faces?.[0]?.name ?? card.name
}

/** Commander + must-include cards in Arena's deck import format. */
export function arenaDeckList(commander: ScryfallCard, cards: ScryfallCard[]): string {
  const names = [...new Set(cards.map(arenaName))].filter((n) => n !== arenaName(commander))
  const lines = ['Commander', `1 ${arenaName(commander)}`]
  if (names.length) lines.push('', 'Deck', ...names.map((n) => `1 ${n}`))
  return lines.join('\n')
}
