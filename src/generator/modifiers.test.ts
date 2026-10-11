import { describe, expect, it } from 'vitest'
import { commanderQuery } from '../scryfall/query'
import {
  creatureTypes,
  DEFAULT_MODIFIERS,
  describeModifiers,
  modifierClauses,
  pickTribe,
  planeswalkerOnlyBlocker,
  type CommanderModifiers,
} from './modifiers'

const withMods = (patch: Partial<CommanderModifiers>): CommanderModifiers => ({ ...DEFAULT_MODIFIERS, ...patch })

describe('modifierClauses', () => {
  it('adds nothing by default', () => {
    expect(modifierClauses(DEFAULT_MODIFIERS)).toEqual([])
  })

  it('rarity', () => {
    expect(modifierClauses(withMods({ rarity: { enabled: true, value: 'uncommon' } }))).toEqual(['r:uncommon'])
    expect(modifierClauses(withMods({ rarity: { enabled: true, value: 'common-uncommon' } }))).toEqual(['r<=uncommon'])
    expect(modifierClauses(withMods({ rarity: { enabled: false, value: 'common' } }))).toEqual([])
  })

  it('hipster mode', () => {
    expect(modifierClauses(withMods({ hipster: { enabled: true, minRank: 8000 } }))).toEqual(['edhrec>8000'])
  })

  it('mana value range, including open-ended and swapped bounds', () => {
    expect(modifierClauses(withMods({ manaValue: { enabled: true, min: 1, max: 3 } }))).toEqual(['mv>=1', 'mv<=3'])
    expect(modifierClauses(withMods({ manaValue: { enabled: true, min: 6, max: 10 } }))).toEqual(['mv>=6'])
    expect(modifierClauses(withMods({ manaValue: { enabled: true, min: 0, max: 2 } }))).toEqual(['mv<=2'])
    expect(modifierClauses(withMods({ manaValue: { enabled: true, min: 5, max: 2 } }))).toEqual(['mv>=2', 'mv<=5'])
  })

  it('creature type: random only requires a creature, chosen adds the type', () => {
    expect(modifierClauses(withMods({ tribe: { enabled: true, mode: 'random', chosen: 'Elf' } }))).toEqual(['t:creature'])
    expect(modifierClauses(withMods({ tribe: { enabled: true, mode: 'chosen', chosen: 'Time Lord' } }))).toEqual([
      't:creature',
      't:"Time Lord"',
    ])
  })

  it('planeswalkers', () => {
    expect(modifierClauses(withMods({ planeswalkers: 'disallow' }))).toEqual(['-t:planeswalker'])
    expect(modifierClauses(withMods({ planeswalkers: 'only' }))).toEqual(['t:planeswalker'])
  })

  it('planeswalkers-only overrides creature-only modifiers', () => {
    const m = withMods({
      planeswalkers: 'only',
      tiny: { enabled: true },
      tribe: { enabled: true, mode: 'random', chosen: '' },
    })
    expect(modifierClauses(m)).toEqual(['t:planeswalker'])
    expect(planeswalkerOnlyBlocker(m)).toBeDefined()
  })

  it('era by years (random set is picked by the generator)', () => {
    expect(modifierClauses(withMods({ era: { enabled: true, mode: 'years', fromYear: 2021, toYear: 2019 } }))).toEqual([
      'year>=2019',
      'year<=2021',
    ])
    expect(modifierClauses(withMods({ era: { enabled: true, mode: 'random-set', fromYear: 2019, toYear: 2021 } }))).toEqual([])
  })

  it('alchemy and tiny', () => {
    expect(modifierClauses(withMods({ alchemy: 'exclude' }))).toEqual(['-is:alchemy'])
    expect(modifierClauses(withMods({ alchemy: 'only' }))).toEqual(['is:alchemy'])
    expect(modifierClauses(withMods({ tiny: { enabled: true } }))).toEqual(['pow<=2'])
  })

  it('reroll budget is not a query', () => {
    expect(modifierClauses(withMods({ rerollBudget: { enabled: true, rerolls: 2 } }))).toEqual([])
  })

  it('combines into a full commander query', () => {
    const m = withMods({ rarity: { enabled: true, value: 'uncommon' }, tiny: { enabled: true } })
    expect(commanderQuery('brawl', { kind: 'exactly', colours: ['R', 'W'] }, modifierClauses(m))).toBe(
      'game:arena f:brawl is:brawler id=wr r:uncommon pow<=2',
    )
  })
})

describe('describeModifiers', () => {
  it('labels active restrictions', () => {
    const m = withMods({ manaValue: { enabled: true, min: 6, max: 10 }, alchemy: 'only' })
    expect(describeModifiers(m)).toEqual(['Mana value 6+', 'Alchemy only'])
  })
})

describe('creatureTypes', () => {
  const catalog = ['Elf', 'Druid', 'Human', 'Time Lord', 'Lord']

  it('reads creature types from the front face', () => {
    expect(creatureTypes('Legendary Creature — Elf Druid', catalog)).toEqual(['Elf', 'Druid'])
    expect(creatureTypes('Legendary Creature — Human // Legendary Planeswalker — Elf', catalog)).toEqual(['Human'])
  })

  it('keeps multi-word types whole', () => {
    expect(creatureTypes('Legendary Creature — Time Lord Human', catalog)).toEqual(['Human', 'Time Lord', 'Lord'])
  })

  it('ignores non-creatures', () => {
    expect(creatureTypes('Legendary Planeswalker — Elf', catalog)).toEqual([])
    expect(creatureTypes('Legendary Artifact — Vehicle', catalog)).toEqual([])
  })
})

describe('pickTribe', () => {
  it('avoids Human when there is another option', () => {
    expect(pickTribe(['Human', 'Wizard'], () => 0)).toBe('Wizard')
    expect(pickTribe(['Human'], () => 0)).toBe('Human')
    expect(pickTribe([], () => 0)).toBeUndefined()
  })
})
