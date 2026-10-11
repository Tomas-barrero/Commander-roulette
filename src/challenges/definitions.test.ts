import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../scryfall/types'
import { defaultParams } from './conflicts'
import { CHALLENGES, CHALLENGES_BY_ID, forbiddenWordClause } from './definitions'
import { poolMode, type ChallengeContext, type ParamValues } from './types'

const def = (id: string) => CHALLENGES_BY_ID[id]
const fragment = (id: string, params: ParamValues = defaultParams(def(id)), choice?: string) =>
  def(id).buildQueryFragment!(params, choice ? { choice } : undefined)
const quotas = (id: string, params: ParamValues = defaultParams(def(id)), choice?: string) =>
  def(id).quotas!(params, choice ? { choice } : undefined, 'brawl')

const ctxFor = (commander: Partial<ScryfallCard>): ChallengeContext => ({
  format: 'brawl',
  nonlandTarget: 60,
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

  it('pool challenges define what their pool needs', () => {
    for (const c of CHALLENGES) {
      const mode = poolMode(c, defaultParams(c))
      if (mode === 'nonland') expect(c.buildQueryFragment, c.id).toBeDefined()
      if (mode === 'quota') expect(c.quotas, c.id).toBeDefined()
    }
  })

  it('only No mulligans is an honour rule', () => {
    expect(CHALLENGES.filter((c) => c.type === 'honour').map((c) => c.id)).toEqual(['no-mulligans'])
  })
})

describe('nonland fragments', () => {
  it('card type restrictions', () => {
    expect(fragment('creatureless')).toBe('-t:creature')
    expect(fragment('creatures-lands-only')).toBe('t:creature')
    expect(fragment('no-instants-sorceries')).toBe('-t:instant -t:sorcery')
    expect(fragment('permanents-only')).toBe('is:permanent')
  })

  it('art & flavour', () => {
    expect(fragment('art-theme', { percent: 100 }, 'hat')).toBe('art:hat')
    expect(fragment('flavour-text')).toBe('has:flavor')
    expect(fragment('quote-book')).toBe('ft:"—"')
    expect(fragment('alphabet-soup', {}, 'k')).toBe('name:/^k/')
  })

  it('mana, budget and banned effects', () => {
    expect(fragment('low-curve', { max: 2 })).toBe('mv<=2')
    expect(fragment('odd-even', { parity: 'random' }, 'even')).toBe('mv:even')
    expect(fragment('commons-uncommons')).toBe('r<=uncommon')
    expect(fragment('single-set', {}, 'dsk|Duskmourn')).toBe('e:dsk')
    expect(fragment('recent-sets', { years: 1 })).toBe(`year>=${new Date().getFullYear()}`)
    expect(fragment('no-counterspells')).toBe('-otag:counterspell')
    expect(fragment('no-tutors')).toBe('-otag:tutor')
    expect(fragment('no-board-wipes')).toBe('-otag:board-wipe')
    expect(fragment('no-ramp')).toBe('-otag:ramp')
    expect(fragment('no-game-changers')).toBe('-is:gamechanger')
  })

  it('funky', () => {
    expect(fragment('forbidden-words', { count: 2 }, 'target|you may')).toBe('-o:/\\btarget/ -o:/\\byou may/')
    expect(forbiddenWordClause(':')).toBe('-o:":"')
    expect(fragment('lipogram', { letter: 'random' }, 'a')).toBe('-name:a')
    expect(fragment('one-word-names')).toBe('name:/^[^ ]+$/')
    expect(fragment('short-names', { max: 9 })).toBe('name:/^.{1,9}$/')
    expect(fragment('legends-only')).toBe('t:legendary')
    expect(fragment('gold-rush')).toBe('c:m')
    expect(fragment('square-deal')).toBe('(-t:creature or pow=tou)')
    expect(fragment('wall-street')).toBe('(-t:creature or tou>pow)')
    expect(fragment('prime-time')).toBe('(mv=2 or mv=3 or mv=5 or mv=7)')
    expect(fragment('no-humans')).toBe('-t:human')
  })
})

describe('quotas', () => {
  it('tribal and type minimums', () => {
    expect(quotas('tribal', { count: 12, source: 'random' }, 'Elf')).toEqual([
      { label: 'Elf creatures', fragment: 't:creature t:"Elf"', needed: 12 },
    ])
    expect(quotas('type-minimum', { count: 8, kind: 'random' }, 'enchantment')[0]).toMatchObject({ fragment: 't:enchantment', needed: 8 })
  })

  it('type quota decodes both minimums', () => {
    expect(quotas('type-quota', {}, 'enchantment:10|equipment:5')).toEqual([
      { label: 'enchantments', fragment: 't:enchantment', needed: 10 },
      { label: 'Equipment', fragment: 't:equipment', needed: 5 },
    ])
  })

  it('art theme switches from "every card" to a quota below 100%', () => {
    expect(poolMode(def('art-theme'), { percent: 100 })).toBe('nonland')
    expect(poolMode(def('art-theme'), { percent: 50 })).toBe('quota')
    expect(quotas('art-theme', { percent: 50 }, 'moon')).toEqual([{ label: 'moon art', fragment: '-t:land art:moon', needed: 30 }])
  })

  it('art bingo has one quota per theme', () => {
    expect(quotas('art-bingo', { count: 4 }, 'hat|moon|cat').map((q) => q.fragment)).toEqual([
      '-t:land art:hat',
      '-t:land art:moon',
      '-t:land art:cat',
    ])
  })

  it('lands and budget', () => {
    expect(quotas('no-basics')[0]).toMatchObject({ fragment: 't:land -t:basic', needed: 38 })
    expect(quotas('wildcard-budget', { rares: 6, mythics: 2 })[0]).toMatchObject({ fragment: '-t:land r<=uncommon', needed: 52 })
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
  })

  it('gold rush needs a multicoloured commander', () => {
    expect(def('gold-rush').unavailable!({}, ctxFor({ color_identity: ['G'] }))).toBeDefined()
    expect(def('gold-rush').unavailable!({}, ctxFor({ color_identity: ['G', 'U'] }))).toBeUndefined()
  })

  it("alphabet soup uses the commander's first letter", async () => {
    expect(await def('alphabet-soup').generate!({}, ctxFor({ name: 'Kolvori, God of Kinship' }))).toEqual({ choice: 'k' })
  })
})
