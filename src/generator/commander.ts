import { getRandomCard, ScryfallError } from '../scryfall/client'
import { commanderQuery, type ColourFilter } from '../scryfall/query'
import type { Format, ScryfallCard } from '../scryfall/types'
import { colourFilterCandidates, describeColourSettings, type ColourSettings } from './colours'

export interface GeneratedCommander {
  card: ScryfallCard
  /** The colour filter that produced this commander. */
  colourFilter: ColourFilter
  /** The exact Scryfall query used. */
  query: string
}

/** Thrown when no Arena commander matches the settings (Scryfall 404). */
export class NoCommanderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoCommanderError'
  }
}

export async function generateCommander(format: Format, colours: ColourSettings): Promise<GeneratedCommander> {
  for (const colourFilter of colourFilterCandidates(colours)) {
    const query = commanderQuery(format, colourFilter)
    try {
      const card = await getRandomCard(query)
      return { card, colourFilter, query }
    } catch (e) {
      // 404 = nothing matches this identity; try the next candidate.
      if (e instanceof ScryfallError && e.status === 404) continue
      throw e
    }
  }
  throw new NoCommanderError(noMatchMessage(colours))
}

function noMatchMessage(colours: ColourSettings): string {
  const what = describeColourSettings(colours)
  if (colours.mode === 'manual' && colours.manual.match === 'exactly') {
    return `No Arena Brawl commander has ${what} as its colour identity. Try "within these colours", or a different combination.`
  }
  return `No Arena Brawl commander matches ${what}. Try a different colour setting.`
}
