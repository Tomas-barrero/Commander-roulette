// Commander modifiers (CLAUDE.md challenges 1–9). Pure functions only, so
// everything here is unit tested in modifiers.test.ts.

export type Difficulty = 1 | 2 | 3

export interface CommanderModifiers {
  rarity: { enabled: boolean; value: 'uncommon' | 'common-uncommon' | 'common' }
  hipster: { enabled: boolean; minRank: number }
  manaValue: { enabled: boolean; min: number; max: number }
  tribe: { enabled: boolean; mode: 'random' | 'chosen'; chosen: string }
  planeswalkers: 'allow' | 'disallow' | 'only'
  era: { enabled: boolean; mode: 'random-set' | 'years'; fromYear: number; toYear: number }
  alchemy: 'include' | 'exclude' | 'only'
  tiny: { enabled: boolean }
  rerollBudget: { enabled: boolean; rerolls: number }
}

export const MV_NO_LIMIT = 10 // a max of 10 on the slider means "10+"

export const DEFAULT_MODIFIERS: CommanderModifiers = {
  rarity: { enabled: false, value: 'uncommon' },
  hipster: { enabled: false, minRank: 10000 },
  manaValue: { enabled: false, min: 1, max: 3 },
  tribe: { enabled: false, mode: 'random', chosen: 'Elf' },
  planeswalkers: 'allow',
  era: { enabled: false, mode: 'random-set', fromYear: 2020, toYear: new Date().getFullYear() },
  alchemy: 'include',
  tiny: { enabled: false },
  rerollBudget: { enabled: false, rerolls: 3 },
}

export type ModifierId = keyof CommanderModifiers

/** Display info for each modifier, in the order they appear in the drawer. */
export const MODIFIER_INFO: { id: ModifierId; name: string; description: string; difficulty: Difficulty }[] = [
  { id: 'rarity', name: 'Commander rarity', description: 'Only lower-rarity commanders.', difficulty: 2 },
  {
    id: 'hipster',
    name: 'Hipster mode',
    description: 'The commander must be obscure: EDHREC rank above N (higher = more obscure). Unranked cards are excluded.',
    difficulty: 2,
  },
  { id: 'manaValue', name: 'Mana value range', description: 'The commander’s mana value must be in this range.', difficulty: 1 },
  { id: 'tribe', name: 'Creature type', description: 'The commander must be a creature of this type.', difficulty: 2 },
  { id: 'planeswalkers', name: 'Planeswalker commanders', description: 'Allow, disallow or require planeswalkers.', difficulty: 1 },
  { id: 'era', name: 'Era', description: 'The commander must have an Arena printing from a random set, or from a range of years.', difficulty: 1 },
  { id: 'alchemy', name: 'Alchemy', description: 'Include, exclude or require digital-only Alchemy cards.', difficulty: 1 },
  { id: 'tiny', name: 'Tiny commander', description: 'The commander’s power is 2 or less (so it must be a creature).', difficulty: 2 },
  { id: 'rerollBudget', name: 'Reroll budget', description: 'Only N rerolls allowed this session. Choose wisely.', difficulty: 1 },
]

/**
 * Why a modifier can't be used with the current settings, if it can't.
 * Creature-only modifiers contradict "planeswalkers only"; if both are
 * somehow on, planeswalkers-only wins and the others are ignored.
 */
export function modifierConflict(id: ModifierId, m: CommanderModifiers): string | undefined {
  if (m.planeswalkers === 'only' && (id === 'tribe' || id === 'tiny')) {
    return 'Not available with planeswalker-only commanders.'
  }
  return undefined
}

/** Why the "planeswalkers only" option is disabled in the UI, if it is. */
export function planeswalkerOnlyBlocker(m: CommanderModifiers): string | undefined {
  if (m.tribe.enabled || m.tiny.enabled) return 'Turn off Creature type and Tiny commander first: they need a creature.'
  return undefined
}

const isActive = (id: ModifierId, m: CommanderModifiers) => !modifierConflict(id, m)

/** Quote a creature type for Scryfall, e.g. t:"Time Lord". */
export const tribeClause = (tribe: string) => `t:"${tribe.replace(/"/g, '')}"`

/**
 * Query clauses for every modifier that maps directly onto a search.
 * A random tribe or random set is picked later by the generator.
 */
export function modifierClauses(m: CommanderModifiers): string[] {
  const clauses: string[] = []

  if (m.rarity.enabled) {
    clauses.push({ uncommon: 'r:uncommon', 'common-uncommon': 'r<=uncommon', common: 'r:common' }[m.rarity.value])
  }
  if (m.hipster.enabled) clauses.push(`edhrec>${m.hipster.minRank}`)
  if (m.manaValue.enabled) {
    const min = Math.min(m.manaValue.min, m.manaValue.max)
    const max = Math.max(m.manaValue.min, m.manaValue.max)
    if (min > 0) clauses.push(`mv>=${min}`)
    if (max < MV_NO_LIMIT) clauses.push(`mv<=${max}`)
  }
  if (m.tribe.enabled && isActive('tribe', m)) {
    clauses.push('t:creature')
    if (m.tribe.mode === 'chosen' && m.tribe.chosen.trim()) clauses.push(tribeClause(m.tribe.chosen.trim()))
  }
  if (m.planeswalkers === 'disallow') clauses.push('-t:planeswalker')
  if (m.planeswalkers === 'only') clauses.push('t:planeswalker')
  if (m.era.enabled && m.era.mode === 'years') {
    clauses.push(`year>=${Math.min(m.era.fromYear, m.era.toYear)}`, `year<=${Math.max(m.era.fromYear, m.era.toYear)}`)
  }
  if (m.alchemy === 'exclude') clauses.push('-is:alchemy')
  if (m.alchemy === 'only') clauses.push('is:alchemy')
  if (m.tiny.enabled && isActive('tiny', m)) clauses.push('pow<=2')

  return clauses
}

/**
 * Human-readable labels for the active commander restrictions, for messages
 * and the results screen. Pass `resolved` to name the random tribe/set picked.
 */
export function describeModifiers(m: CommanderModifiers, resolved: { tribe?: string; setName?: string } = {}): string[] {
  const out: string[] = []
  if (m.rarity.enabled) {
    out.push({ uncommon: 'Uncommon only', 'common-uncommon': 'Common or uncommon', common: 'Common only' }[m.rarity.value])
  }
  if (m.hipster.enabled) out.push(`EDHREC rank > ${m.hipster.minRank.toLocaleString()}`)
  if (m.manaValue.enabled) {
    const min = Math.min(m.manaValue.min, m.manaValue.max)
    const max = Math.max(m.manaValue.min, m.manaValue.max)
    out.push(max >= MV_NO_LIMIT ? `Mana value ${min}+` : min === max ? `Mana value ${min}` : `Mana value ${min}–${max}`)
  }
  if (m.tribe.enabled && isActive('tribe', m)) {
    const tribe = m.tribe.mode === 'chosen' ? m.tribe.chosen : resolved.tribe
    out.push(tribe ? `Creature type: ${tribe}` : 'Random creature type')
  }
  if (m.planeswalkers === 'disallow') out.push('No planeswalkers')
  if (m.planeswalkers === 'only') out.push('Planeswalkers only')
  if (m.era.enabled) {
    const set = resolved.setName ? `Set: ${resolved.setName}` : 'From a random set'
    out.push(m.era.mode === 'random-set' ? set : `Printed ${Math.min(m.era.fromYear, m.era.toYear)}–${Math.max(m.era.fromYear, m.era.toYear)}`)
  }
  if (m.alchemy === 'exclude') out.push('No Alchemy')
  if (m.alchemy === 'only') out.push('Alchemy only')
  if (m.tiny.enabled && isActive('tiny', m)) out.push('Power 2 or less')
  return out
}

/**
 * Creature types on the front face of a type line, matched against the
 * creature-type catalog so multi-word types like "Time Lord" stay whole.
 */
export function creatureTypes(typeLine: string, catalog: string[]): string[] {
  const front = typeLine.split(' // ')[0]
  const [types, subtypes] = front.split(' — ')
  if (!subtypes || !/\bCreature\b/.test(types)) return []
  const padded = ` ${subtypes.trim()} `
  return catalog.filter((t) => padded.includes(` ${t} `))
}

/** Pick a random tribe, avoiding Human when there's another choice (it's ~40% of commanders). */
export function pickTribe(types: string[], random: () => number = Math.random): string | undefined {
  const choices = types.length > 1 ? types.filter((t) => t !== 'Human') : types
  return choices[Math.floor(random() * choices.length)]
}
