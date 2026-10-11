import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../scryfall/types'
import { arenaDeckList, arenaName } from './arenaExport'

const card = (name: string, faces?: string[]) =>
  ({ name, card_faces: faces?.map((n) => ({ name: n })) }) as ScryfallCard

describe('arenaName', () => {
  it('uses the plain name for normal cards', () => {
    expect(arenaName(card('Lim-Dûl the Necromancer'))).toBe('Lim-Dûl the Necromancer')
  })

  it('uses the front face for double-faced, adventure and split cards', () => {
    expect(arenaName(card('Delver of Secrets // Insectile Aberration', ['Delver of Secrets', 'Insectile Aberration']))).toBe(
      'Delver of Secrets',
    )
    expect(arenaName(card('Bonecrusher Giant // Stomp', ['Bonecrusher Giant', 'Stomp']))).toBe('Bonecrusher Giant')
  })
})

describe('arenaDeckList', () => {
  it('matches the Arena import format', () => {
    expect(arenaDeckList(card('Atraxa, Grand Unifier'), [card('Sol Ring'), card('Opt')])).toBe(
      'Commander\n1 Atraxa, Grand Unifier\n\nDeck\n1 Sol Ring\n1 Opt',
    )
  })

  it('leaves out the Deck section when there are no must-includes', () => {
    expect(arenaDeckList(card('Atraxa, Grand Unifier'), [])).toBe('Commander\n1 Atraxa, Grand Unifier')
  })

  it('removes duplicates and the commander itself', () => {
    expect(arenaDeckList(card('A'), [card('B'), card('B'), card('A')])).toBe('Commander\n1 A\n\nDeck\n1 B')
  })
})
