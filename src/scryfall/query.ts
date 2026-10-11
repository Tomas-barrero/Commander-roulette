// Pure helpers that build Scryfall search strings. No network access here,
// so everything in this file is unit tested (see query.test.ts).

import type { Colour, Format } from './types'

export const WUBRG: Colour[] = ['W', 'U', 'B', 'R', 'G']

export type ColourFilter =
  | { kind: 'any' }
  | { kind: 'exactly'; colours: Colour[] }
  | { kind: 'within'; colours: Colour[]; includeColourless: boolean }

/** Sort colours into WUBRG order and remove duplicates. */
export function sortColours(colours: Colour[]): Colour[] {
  return WUBRG.filter((c) => colours.includes(c))
}

/** Scryfall identity code: ['U','W'] -> "wu", [] -> "c" (colourless). */
export function identityCode(colours: Colour[]): string {
  const sorted = sortColours(colours)
  return sorted.length === 0 ? 'c' : sorted.join('').toLowerCase()
}

/**
 * The colour identity part of a query.
 * Note: `id:wu` means "within" on Scryfall, not "exactly", so we always use
 * the explicit `id=` / `id<=` operators.
 */
export function colourClause(filter: ColourFilter): string {
  switch (filter.kind) {
    case 'any':
      return ''
    case 'exactly':
      return `id=${identityCode(filter.colours)}`
    case 'within': {
      if (filter.colours.length === 0) return 'id=c'
      const clause = `id<=${identityCode(filter.colours)}`
      // `id<=` always includes colourless cards; exclude them if asked.
      return filter.includeColourless ? clause : `${clause} -id=c`
    }
  }
}

/** Restricts any query to cards on Arena that are legal in the format. */
export function arenaClause(format: Format): string {
  return `game:arena f:${format}`
}

/** Join query clauses, skipping empty ones. */
export function joinClauses(...clauses: (string | false | null | undefined)[]): string {
  return clauses
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .join(' ')
}

/** Query for a Brawl commander on Arena in the given colours, plus any extra clauses. */
export function commanderQuery(format: Format, colours: ColourFilter, extra: string[] = []): string {
  return joinClauses(arenaClause(format), 'is:brawler', colourClause(colours), ...extra)
}
