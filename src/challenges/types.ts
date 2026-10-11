import type { Difficulty } from '../generator/modifiers'
import type { Format, ScryfallCard } from '../scryfall/types'

export type ChallengeCategory = 'must-include' | 'card-types' | 'art' | 'mana' | 'budget' | 'banned' | 'goals'

export const CATEGORIES: { id: ChallengeCategory; name: string; icon: string }[] = [
  { id: 'must-include', name: 'Must-include cards', icon: '🎁' },
  { id: 'card-types', name: 'Card type restrictions', icon: '🃏' },
  { id: 'art', name: 'Art & flavour', icon: '🎨' },
  { id: 'mana', name: 'Mana & curve', icon: '💧' },
  { id: 'budget', name: 'Arena budget', icon: '💰' },
  { id: 'banned', name: 'Banned effects', icon: '🚫' },
  { id: 'goals', name: 'Alternate goals', icon: '🏆' },
]

export type ParamValue = number | string
export type ParamValues = Record<string, ParamValue>

/** A challenge parameter; the settings drawer renders these automatically. */
export type ParamDef =
  | { kind: 'number'; key: string; label: string; min: number; max: number; step?: number; default: number }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[]; default: string }

export interface ChallengeContext {
  format: Format
  commander: ScryfallCard
  /** `game:arena f:<format> id<=<identity>`: every deck query starts with this. */
  deckBase: string
  /** Combined fragment of the active "every nonland card must…" rules, so generated cards obey them. */
  restrictions: string
  /** Oracle IDs already used (the commander and earlier must-includes), to avoid duplicates. */
  taken: Set<string>
  random: () => number
}

/** What a challenge's `generate` produced. */
export interface Generated {
  /** Must-include cards. */
  cards?: ScryfallCard[]
  /** A random pick the rule depends on, e.g. a creature type or function tag. */
  choice?: string
}

export interface ChallengeDefinition {
  id: string
  name: string
  description: string
  category: ChallengeCategory
  difficulty: Difficulty
  /** auto: the app generates or validates something. honour: a rule you follow yourself. */
  type: 'auto' | 'honour'
  params?: ParamDef[]
  /** Challenge ids that can't be on at the same time (checked in both directions). */
  conflictsWith?: string[]
  /** Why this challenge doesn't make sense with this commander, if it doesn't. */
  unavailable?(params: ParamValues, ctx: ChallengeContext): string | undefined
  /**
   * Pool check. 'nonland': every nonland card in the deck must match the fragment.
   * 'quota': at least `quota(params)` cards must match it.
   */
  pool?: 'nonland' | 'quota'
  quota?(params: ParamValues): number
  /** The Scryfall fragment for the pool check (and, for 'nonland', for generated cards). */
  buildQueryFragment?(params: ParamValues, generated: Generated | undefined): string
  /** Picks random cards or choices. Has its own "reroll this challenge" button. */
  generate?(params: ParamValues, ctx: ChallengeContext): Promise<Generated>
  /** One line for the results screen. */
  summary(params: ParamValues, generated: Generated | undefined): string
}
