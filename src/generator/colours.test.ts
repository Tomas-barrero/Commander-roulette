import { describe, expect, it } from 'vitest'
import { colourClause } from '../scryfall/query'
import { colourFilterCandidates, combinations, identityName, manualSelectionProblem, type ColourSettings } from './colours'

const colourQueryFor = (settings: ColourSettings) => colourFilterCandidates(settings).map(colourClause)

const manual = (m: Partial<ColourSettings['manual']>): ColourSettings => ({
  mode: 'manual',
  manual: { colours: [], colourless: false, match: 'exactly', ...m },
})

describe('combinations', () => {
  it('has the right number of identities for each colour count', () => {
    expect([1, 2, 3, 4, 5].map((n) => combinations(n).length)).toEqual([5, 10, 10, 5, 1])
  })
})

describe('identityName', () => {
  it('names guilds, shards, wedges and mono colours', () => {
    expect(identityName(['U', 'W'])).toBe('Azorius')
    expect(identityName(['B', 'R', 'G'])).toBe('Jund')
    expect(identityName(['W', 'B', 'R'])).toBe('Mardu')
    expect(identityName(['R'])).toBe('Mono-Red')
    expect(identityName([])).toBe('Colourless')
    expect(identityName(['W', 'U', 'B', 'R', 'G'])).toBe('Five-colour')
  })
})

describe('colourFilterCandidates', () => {
  it('fully random has no colour clause', () => {
    expect(colourQueryFor({ mode: 'random', manual: manual({}).manual })).toEqual([''])
  })

  it('N-colour mode tries every N-colour identity exactly once', () => {
    const queries = colourQueryFor({ mode: '2', manual: manual({}).manual })
    expect(queries).toHaveLength(10)
    expect(new Set(queries).size).toBe(10)
    expect(queries.every((q) => /^id=[wubrg]{2}$/.test(q))).toBe(true)
  })

  it('manual exactly', () => {
    expect(colourQueryFor(manual({ colours: ['G', 'W'] }))).toEqual(['id=wg'])
    expect(colourQueryFor(manual({ colourless: true }))).toEqual(['id=c'])
  })

  it('manual within, with and without colourless', () => {
    expect(colourQueryFor(manual({ colours: ['U', 'R'], match: 'within', colourless: true }))).toEqual(['id<=ur'])
    expect(colourQueryFor(manual({ colours: ['U', 'R'], match: 'within' }))).toEqual(['id<=ur -id=c'])
  })

  it('flags an empty manual selection', () => {
    expect(manualSelectionProblem(manual({}))).toBeDefined()
    expect(manualSelectionProblem(manual({ colourless: true }))).toBeUndefined()
  })
})
