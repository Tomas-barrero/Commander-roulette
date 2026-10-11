import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../scryfall/types'
import { defaultParams } from './conflicts'
import { CHALLENGES, CHALLENGES_BY_ID } from './definitions'
import type { ChallengeContext } from './types'

const def = (id: string) => CHALLENGES_BY_ID[id]
const fragment = (id: string, params = defaultParams(def(id)), choice?: string) =>
  def(id).buildQueryFragment!(params, choice ? { choice } : undefined)

const ctxFor = (commander: Partial<ScryfallCard>): ChallengeContext => ({
  format: 'brawl',
  commander: { cmc: 3, type_line: 'Legendary Creature — Elf Druid', color_identity: ['G'], ...commander } as ScryfallCard,
  deckBase: 'game:arena f:brawl id<=g',
  restrictions: '',
  taken: new Set(),
  random: () => 0,
})

describe('challenge definitions', () => {
  it('have unique ids', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length)
  })

  it('only conflict with challenges that exist', () => {
    for (const c of CHALLENGES) for (const other of c.conflictsWith ?? []) expect(CHALLENGES_BY_ID).toHaveProperty(other)
  })

  it('have defaults inside their parameter ranges', () => {
    for (const c of CHALLENGES) {
      for (const p of c.params ?? []) {
        if (p.kind === 'number') {
          expect(p.default).toBeGreaterThanOrEqual(p.min)
          expect(p.default).toBeLessThanOrEqual(p.max)
        } else {
          expect(p.options.map((o) => o.value)).toContain(p.default)
        }
      }
    }
  })

  it('auto pool challenges build a fragment; honour challenges do not', () => {
    for (const c of CHALLENGES) {
      if (c.pool) expect(c.buildQueryFragment).toBeDefined()
      if (c.type === 'honour') expect(c.buildQueryFragment).toBeUndefined()
      if (c.pool === 'quota') expect(c.quota).toBeDefined()
    }
  })
})

describe('query fragments', () => {
  it('card type restrictions', () => {
    expect(fragment('creatureless')).toBe('-t:creature')
    expect(fragment('creatures-lands-only')).toBe('t:creature')
    expect(fragment('no-instants-sorceries')).toBe('-t:instant -t:sorcery')
    expect(fragment('permanents-only')).toBe('is:permanent')
  })

  it('tribal uses the chosen creature type', () => {
    expect(fragment('tribal', defaultParams(def('tribal')), 'Elf')).toBe('t:creature t:"Elf"')
    expect(def('tribal').quota!({ count: 12, source: 'random' })).toBe(12)
  })

  it('low curve, budget and banned effects', () => {
    expect(fragment('low-curve', { max: 2 })).toBe('mv<=2')
    expect(fragment('commons-uncommons')).toBe('r<=uncommon')
    expect(fragment('no-counterspells')).toBe('-otag:counterspell')
    expect(fragment('no-tutors')).toBe('-otag:tutor')
    expect(fragment('no-board-wipes')).toBe('-otag:board-wipe')
    expect(fragment('no-ramp')).toBe('-otag:ramp')
    expect(fragment('no-game-changers')).toBe('-is:gamechanger')
  })
})

describe('commander-dependent availability', () => {
  it('low curve is unavailable for an expensive commander', () => {
    expect(def('low-curve').unavailable!({ max: 3 }, ctxFor({ cmc: 7 }))).toMatch(/costs 7/)
    expect(def('low-curve').unavailable!({ max: 3 }, ctxFor({ cmc: 3 }))).toBeUndefined()
  })

  it("tribal with the commander's type needs a creature commander", () => {
    const planeswalker = ctxFor({ type_line: 'Legendary Planeswalker — Jace' })
    expect(def('tribal').unavailable!({ count: 10, source: 'commander' }, planeswalker)).toBeDefined()
    expect(def('tribal').unavailable!({ count: 10, source: 'random' }, planeswalker)).toBeUndefined()
    expect(def('tribal').unavailable!({ count: 10, source: 'commander' }, ctxFor({}))).toBeUndefined()
  })
})
