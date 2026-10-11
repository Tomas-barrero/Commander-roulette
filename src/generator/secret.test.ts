import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../scryfall/types'
import { canFind, cardTypes, intersectIdentities, meetsCondition, searchTargets, secretColourClause, tutorTagClause } from './secret'

const card = (type_line: string, oracle_text = '', extra: Partial<ScryfallCard> = {}) =>
  ({ name: 'X', type_line, oracle_text, cmc: 3, keywords: [], ...extra }) as ScryfallCard
const tutor = (oracle_text: string) => card('Instant', oracle_text)

describe('cardTypes', () => {
  it('lists permanent types from the front face', () => {
    expect(cardTypes(card('Artifact Creature — Golem'))).toEqual(['creature', 'artifact'])
    expect(cardTypes(card('Enchantment — Aura'))).toEqual(['enchantment'])
    expect(cardTypes(card('Land // Instant'))).toEqual(['land'])
  })
})

describe('searchTargets', () => {
  it('reads what a search can find', () => {
    const alts = (text: string) => searchTargets(text).map((s) => s.alternatives)
    expect(alts('Search your library for a card, put it into your hand.')).toEqual([[[]]])
    expect(alts('Search your library for an artifact or enchantment card.')).toEqual([[['artifact'], ['enchantment']]])
    expect(alts('search your library for up to two basic land cards')).toEqual([[['basic', 'land']]])
    expect(alts('Search your library for an artifact, creature, or enchantment card')).toEqual([
      [['artifact'], ['creature'], ['enchantment']],
    ])
  })

  it('keeps the condition after "card"', () => {
    expect(searchTargets('Search your library for a creature card with mana value 3 or less, reveal it.')[0].condition).toBe(
      'with mana value 3 or less',
    )
    expect(searchTargets('Search your library for a card, put it into your hand.')[0].condition).toBe('')
  })

  it('ignores text without a library search', () => {
    expect(searchTargets('Draw two cards.')).toEqual([])
  })
})

describe('canFind', () => {
  const enchantment = card('Enchantment', 'Whenever you gain life, draw a card.')
  const aura = card('Enchantment — Aura')
  const artifactCreature = card('Artifact Creature — Construct')
  const nonbasicLand = card('Land')

  it('accepts tutors whose search covers the card', () => {
    expect(canFind(tutor('Search your library for a card.'), enchantment)).toBe(true)
    expect(canFind(tutor('Search your library for an enchantment card.'), enchantment)).toBe(true)
    expect(canFind(tutor('Search your library for an artifact or creature card.'), artifactCreature)).toBe(true)
    expect(canFind(tutor('Search your library for a nonland permanent card.'), artifactCreature)).toBe(true)
    expect(canFind(tutor('Search your library for a land card.'), nonbasicLand)).toBe(true)
  })

  it('rejects tutors that only find something narrower', () => {
    // e.g. Light-Paws is tagged as an enchantment tutor, but it only finds Auras.
    expect(canFind(tutor('Search your library for an Aura card.'), enchantment)).toBe(false)
    expect(canFind(tutor('Search your library for an Aura card.'), aura)).toBe(true)
    expect(canFind(tutor('Search your library for a basic land card.'), nonbasicLand)).toBe(false)
    expect(canFind(tutor('Search your library for a creature card.'), enchantment)).toBe(false)
    expect(canFind(tutor('Search your library for a nonland card.'), nonbasicLand)).toBe(false)
    expect(canFind(tutor('Draw a card.'), enchantment)).toBe(false)
  })

  it('reads every face of a double-faced tutor', () => {
    const dfc = { name: 'A // B', type_line: 'Creature // Sorcery', card_faces: [{ name: 'A', oracle_text: 'Flying' }, { name: 'B', oracle_text: 'Search your library for an enchantment card.' }] } as ScryfallCard
    expect(canFind(dfc, enchantment)).toBe(true)
  })
})

describe('conditions after "card"', () => {
  const fiveDrop = card('Artifact Creature — Golem', '', { cmc: 5 })
  const wall = card('Creature — Wall', '', { cmc: 2, keywords: ['Defender'] })

  it('checks mana value limits', () => {
    expect(meetsCondition('with mana value 6 or greater', fiveDrop)).toBe(false)
    expect(meetsCondition('with mana value 5 or less', fiveDrop)).toBe(true)
    expect(meetsCondition('with mana value two or less', wall)).toBe(true)
  })

  it('checks keywords', () => {
    expect(meetsCondition('with defender', wall)).toBe(true)
    expect(meetsCondition('with defender', fiveDrop)).toBe(false)
  })

  it('accepts conditions you can set up, and rejects ones it can’t judge', () => {
    expect(meetsCondition('with mana value equal to 1 plus the sacrificed creature’s mana value', fiveDrop)).toBe(true)
    expect(meetsCondition('with the same name as another creature you control', fiveDrop)).toBe(false)
    expect(meetsCondition('named rat colony', fiveDrop)).toBe(false)
  })

  it('is part of canFind', () => {
    // The real misses from the live test: Fierce Empath, Shield-Wall Sentinel, Pattern Matcher.
    expect(canFind(tutor('Search your library for a creature card with mana value 6 or greater, reveal it.'), fiveDrop)).toBe(false)
    expect(canFind(tutor('Search your library for a creature card with defender, reveal it.'), fiveDrop)).toBe(false)
    expect(canFind(tutor('Search your library for a creature card with defender, reveal it.'), wall)).toBe(true)
    expect(canFind(tutor('Search your library for a card with the same name as another creature you control.'), wall)).toBe(false)
  })
})

describe('colour helpers', () => {
  it('intersects identities', () => {
    expect(intersectIdentities([['W', 'U'], ['W', 'B', 'U'], ['U', 'W', 'G']])).toEqual(['W', 'U'])
    expect(intersectIdentities([['R'], ['G']])).toEqual([])
  })

  it('lets the secret card be any subset of the deck colours', () => {
    expect(secretColourClause({ kind: 'any' })).toBe('')
    expect(secretColourClause({ kind: 'exactly', colours: ['W', 'U'] })).toBe('id<=wu')
    expect(secretColourClause({ kind: 'within', colours: ['B'], includeColourless: false })).toBe('id<=b')
  })

  it('builds the tutor tag clause for the card types', () => {
    expect(tutorTagClause(['creature', 'artifact'])).toBe('(otag:tutor-card or otag:tutor-permanent or otag:tutor-creature or otag:tutor-artifact)')
  })
})
