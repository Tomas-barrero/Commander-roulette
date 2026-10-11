import { loadCreatureTypes } from '../scryfall/catalog'
import { getRandomCard, ScryfallError } from '../scryfall/client'
import { commanderQuery, type ColourFilter } from '../scryfall/query'
import type { ScryfallCard } from '../scryfall/types'
import type { Settings } from '../state/settings'
import { colourFilterCandidates, describeColourSettings } from './colours'
import { creatureTypes, describeModifiers, modifierClauses, modifierConflict, pickTribe, tribeClause } from './modifiers'
import type { SecretInfo } from './secret'

export interface GeneratedCommander {
  card: ScryfallCard
  /** The colour filter that produced this commander (not kept for shared or restored ones). */
  colourFilter?: ColourFilter
  /** The exact Scryfall query used (not kept for shared or restored ones). */
  query?: string
  /** The creature type, when the Creature type modifier is on. */
  tribe?: string
  /** The set, when Era is "random set". */
  set?: { code: string; name: string }
  /** Labels for the commander restrictions that applied, e.g. "Creature type: Elf". */
  restrictions: string[]
  /** Secret commander mode: `card` is the secret card, and this has the suggested commanders and tutors. */
  secret?: SecretInfo
}

/** Thrown when no Arena commander matches the settings (Scryfall 404). */
export class NoCommanderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoCommanderError'
  }
}

const is404 = (e: unknown) => e instanceof ScryfallError && e.status === 404

/**
 * Random tribe: draw a random creature commander that fits everything else
 * and use one of its creature types, so the tribe always has a match.
 */
async function pickRandomTribe(query: string): Promise<string | undefined> {
  const catalog = await loadCreatureTypes()
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = await getRandomCard(query)
    const tribe = pickTribe(creatureTypes(seed.type_line ?? seed.card_faces?.[0]?.type_line ?? '', catalog))
    if (tribe) return tribe
  }
  return undefined // very unlucky: commanders without creature types
}

export async function generateCommander(settings: Settings): Promise<GeneratedCommander> {
  const { format, colours, modifiers } = settings

  for (const colourFilter of colourFilterCandidates(colours)) {
    const clauses = modifierClauses(modifiers)
    const query = () => commanderQuery(format, colourFilter, clauses)
    try {
      let tribe: string | undefined
      if (modifiers.tribe.enabled && !modifierConflict('tribe', modifiers)) {
        tribe = modifiers.tribe.mode === 'chosen' ? modifiers.tribe.chosen.trim() : await pickRandomTribe(query())
        if (tribe && modifiers.tribe.mode === 'random') clauses.push(tribeClause(tribe))
      }

      // Random set works the same way: take the set of a random matching commander.
      let set: GeneratedCommander['set']
      if (modifiers.era.enabled && modifiers.era.mode === 'random-set') {
        const seed = await getRandomCard(query())
        set = { code: seed.set, name: seed.set_name }
        clauses.push(`e:${seed.set}`)
      }

      const card = await getRandomCard(query())
      const restrictions = describeModifiers(modifiers, { tribe, setName: set?.name })
      return { card, colourFilter, query: query(), tribe, set, restrictions }
    } catch (e) {
      // 404 = nothing matches with this identity; try the next candidate.
      if (is404(e)) continue
      throw e
    }
  }
  throw new NoCommanderError(noMatchMessage(settings))
}

function noMatchMessage({ colours, modifiers }: Settings): string {
  const what = describeColourSettings(colours)
  const restrictions = describeModifiers(modifiers)
  if (restrictions.length) {
    return `No Arena Brawl commander matches ${what} with: ${restrictions.join(', ')}. Try turning one of these off in Settings, or loosen your colours.`
  }
  if (colours.mode === 'manual' && colours.manual.match === 'exactly') {
    return `No Arena Brawl commander has ${what} as its colour identity. Try "within these colours", or a different combination.`
  }
  return `No Arena Brawl commander matches ${what}. Try a different colour setting.`
}
