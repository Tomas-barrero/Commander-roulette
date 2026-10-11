import { describe, expect, it } from 'vitest'
import { deckBaseQuery, feasibility, nonlandPoolQuery, quotaPoolQuery } from './feasibility'

describe('feasibility', () => {
  it('grades pool sizes against what the deck needs', () => {
    expect(feasibility(59, 60)).toBe('too-small')
    expect(feasibility(60, 60)).toBe('tight')
    expect(feasibility(119, 60)).toBe('tight')
    expect(feasibility(120, 60)).toBe('ok')
  })
})

describe('pool queries', () => {
  it('deck base covers Arena, format and the commander identity', () => {
    expect(deckBaseQuery('brawl', ['G', 'W'])).toBe('game:arena f:brawl id<=wg')
    expect(deckBaseQuery('standardbrawl', [])).toBe('game:arena f:standardbrawl id=c')
  })

  it('nonland rules exclude lands', () => {
    expect(nonlandPoolQuery('game:arena f:brawl id<=g', 'mv<=3')).toBe('game:arena f:brawl id<=g -t:land mv<=3')
  })

  it('quota rules include the other restrictions', () => {
    expect(quotaPoolQuery('game:arena f:brawl id<=g', 'mv<=3 -otag:ramp', 't:creature t:"Elf"')).toBe(
      'game:arena f:brawl id<=g mv<=3 -otag:ramp t:creature t:"Elf"',
    )
  })
})
