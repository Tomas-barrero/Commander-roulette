// Pure helpers for pool-size checks. Tested in feasibility.test.ts.

import { arenaClause, colourClause, joinClauses } from '../scryfall/query'
import type { Colour, Format } from '../scryfall/types'

export type FeasibilityLevel = 'ok' | 'tight' | 'too-small'

/**
 * Roughly how many different nonland cards a deck needs: Brawl is 99 + commander
 * with ~38 lands; Standard Brawl is 59 + commander with ~24 lands. Basics can fill
 * the lands, so the nonland pool is what matters.
 */
export const NONLAND_TARGET: Record<Format, number> = { brawl: 60, standardbrawl: 35 }

/** Under `needed` is too small to build; under twice that leaves very few choices. */
export function feasibility(count: number, needed: number): FeasibilityLevel {
  if (count < needed) return 'too-small'
  if (count < needed * 2) return 'tight'
  return 'ok'
}

/** `game:arena f:<format> id<=<identity>`: cards you can put in this commander's deck. */
export function deckBaseQuery(format: Format, identity: Colour[]): string {
  return joinClauses(arenaClause(format), colourClause({ kind: 'within', colours: identity, includeColourless: true }))
}

/** Pool for an "every nonland card must…" rule. */
export function nonlandPoolQuery(deckBase: string, fragment: string): string {
  return joinClauses(deckBase, '-t:land', fragment)
}

/** Pool for an "at least N cards must…" rule; those cards must still obey the other rules. */
export function quotaPoolQuery(deckBase: string, restrictions: string, fragment: string): string {
  return joinClauses(deckBase, restrictions, fragment)
}
