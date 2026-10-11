import { describe, expect, it } from 'vitest'
import { arenaClause, colourClause, commanderQuery, identityCode, joinClauses, sortColours } from './query'

describe('identityCode', () => {
  it('lowercases and sorts into WUBRG order', () => {
    expect(identityCode(['U', 'W'])).toBe('wu')
    expect(identityCode(['G', 'B', 'R'])).toBe('brg')
    expect(identityCode(['G', 'R', 'B', 'U', 'W'])).toBe('wubrg')
  })

  it('uses c for colourless', () => {
    expect(identityCode([])).toBe('c')
  })

  it('removes duplicates', () => {
    expect(sortColours(['W', 'W', 'U'])).toEqual(['W', 'U'])
  })
})

describe('colourClause', () => {
  it('adds nothing for any identity', () => {
    expect(colourClause({ kind: 'any' })).toBe('')
  })

  it('uses id= for exact identities', () => {
    expect(colourClause({ kind: 'exactly', colours: ['W', 'U'] })).toBe('id=wu')
    expect(colourClause({ kind: 'exactly', colours: ['R'] })).toBe('id=r')
    expect(colourClause({ kind: 'exactly', colours: [] })).toBe('id=c')
  })

  it('uses id<= for "within", including colourless by default', () => {
    expect(colourClause({ kind: 'within', colours: ['B', 'W'], includeColourless: true })).toBe('id<=wb')
  })

  it('excludes colourless from "within" when asked', () => {
    expect(colourClause({ kind: 'within', colours: ['B', 'W'], includeColourless: false })).toBe('id<=wb -id=c')
  })

  it('treats "within nothing" as colourless only', () => {
    expect(colourClause({ kind: 'within', colours: [], includeColourless: true })).toBe('id=c')
  })
})

describe('joinClauses', () => {
  it('skips empty and falsy clauses', () => {
    expect(joinClauses('a', '', undefined, false, null, '  b  ')).toBe('a b')
  })
})

describe('commanderQuery', () => {
  it('always restricts to Arena, the format and brawlers', () => {
    expect(arenaClause('brawl')).toBe('game:arena f:brawl')
    expect(commanderQuery('brawl', { kind: 'any' })).toBe('game:arena f:brawl is:brawler')
  })

  it('combines format, colours and extra clauses', () => {
    expect(commanderQuery('standardbrawl', { kind: 'exactly', colours: ['G', 'B'] }, ['r:uncommon'])).toBe(
      'game:arena f:standardbrawl is:brawler id=bg r:uncommon',
    )
  })
})
