import { sortColours, WUBRG, type ColourFilter } from '../scryfall/query'
import type { Colour } from '../scryfall/types'

export type ColourMode = 'random' | '1' | '2' | '3' | '4' | '5' | 'manual'

export interface ColourSettings {
  mode: ColourMode
  manual: {
    colours: Colour[]
    /** Exactly mode: pick colourless commanders. Within mode: allow colourless commanders too. */
    colourless: boolean
    match: 'exactly' | 'within'
  }
}

export const DEFAULT_COLOUR_SETTINGS: ColourSettings = {
  mode: 'random',
  manual: { colours: ['W', 'U'], colourless: false, match: 'exactly' },
}

export const COLOUR_NAMES: Record<Colour, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}

// Keyed by identity in WUBRG order.
const IDENTITY_NAMES: Record<string, string> = {
  WU: 'Azorius',
  UB: 'Dimir',
  BR: 'Rakdos',
  RG: 'Gruul',
  WG: 'Selesnya',
  WB: 'Orzhov',
  UR: 'Izzet',
  BG: 'Golgari',
  WR: 'Boros',
  UG: 'Simic',
  WUG: 'Bant',
  WUB: 'Esper',
  UBR: 'Grixis',
  BRG: 'Jund',
  WRG: 'Naya',
  WBG: 'Abzan',
  WUR: 'Jeskai',
  UBG: 'Sultai',
  WBR: 'Mardu',
  URG: 'Temur',
  WUBR: 'Yore-Tiller',
  UBRG: 'Glint-Eye',
  WBRG: 'Dune-Brood',
  WURG: 'Ink-Treader',
  WUBG: 'Witch-Maw',
  WUBRG: 'Five-colour',
}

/** "Azorius", "Mono-Red", "Colourless", etc. */
export function identityName(colours: Colour[]): string {
  const sorted = sortColours(colours)
  if (sorted.length === 0) return 'Colourless'
  if (sorted.length === 1) return `Mono-${COLOUR_NAMES[sorted[0]]}`
  return IDENTITY_NAMES[sorted.join('')] ?? sorted.join('')
}

/** Every combination of exactly n colours, in WUBRG order. */
export function combinations(n: number, from: Colour[] = WUBRG): Colour[][] {
  if (n === 0) return [[]]
  if (from.length < n) return []
  const [first, ...rest] = from
  return [...combinations(n - 1, rest).map((combo) => [first, ...combo]), ...combinations(n, rest)]
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Can we generate with these manual settings? Returns a reason if not. */
export function manualSelectionProblem(settings: ColourSettings): string | undefined {
  if (settings.mode !== 'manual') return undefined
  const { colours, colourless } = settings.manual
  if (colours.length === 0 && !colourless) return 'Pick at least one colour (or colourless).'
  return undefined
}

/**
 * The colour filters to try, in order. "N colours" modes return every
 * N-colour identity in random order: some identities have no Arena
 * commanders at all (e.g. UBRG), so the generator falls through to the next.
 */
export function colourFilterCandidates(settings: ColourSettings, random: () => number = Math.random): ColourFilter[] {
  const { mode, manual } = settings
  if (mode === 'random') return [{ kind: 'any' }]
  if (mode === 'manual') {
    if (manual.match === 'exactly') {
      return [{ kind: 'exactly', colours: manual.colourless ? [] : sortColours(manual.colours) }]
    }
    return [{ kind: 'within', colours: sortColours(manual.colours), includeColourless: manual.colourless }]
  }
  return shuffle(combinations(Number(mode)), random).map((colours) => ({ kind: 'exactly', colours }))
}

/** Plain-English description of the colour setting, for messages. */
export function describeColourSettings(settings: ColourSettings): string {
  const { mode, manual } = settings
  if (mode === 'random') return 'any colour identity'
  if (mode === 'manual') {
    if (manual.match === 'exactly') {
      return `exactly ${identityName(manual.colourless ? [] : manual.colours)}`
    }
    const within = manual.colours.length ? `within ${identityName(manual.colours)}` : 'colourless'
    return manual.colourless || manual.colours.length === 0 ? within : `${within} (no colourless)`
  }
  const names = ['', 'mono-colour', 'two-colour', 'three-colour', 'four-colour', 'five-colour']
  return `any ${names[Number(mode)]} identity`
}
