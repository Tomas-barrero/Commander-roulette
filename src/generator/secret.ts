// Secret commander mode: a non-legendary build-around card is the real star of
// the deck. It can't sit in the command zone, so we also suggest commanders
// that can search for it or share its strategy, plus tutors to find it.

import { searchCards } from '../scryfall/client'
import { arenaClause, colourClause, identityCode, joinClauses, sortColours, type ColourFilter } from '../scryfall/query'
import type { Colour, Format, ScryfallCard } from '../scryfall/types'
import type { Settings } from '../state/settings'
import { colourFilterCandidates, describeColourSettings, shuffle } from './colours'
import { NoCommanderError, type GeneratedCommander } from './commander'

export type SecretType = 'any' | 'creature' | 'artifact' | 'enchantment' | 'land'

export interface SecretSettings {
  enabled: boolean
  /** Restrict the secret card to one card type. */
  type: SecretType
}

export const DEFAULT_SECRET: SecretSettings = { enabled: false, type: 'any' }

/**
 * Strategies a secret card can pay off. Scryfall's `synergy-*` / `*-matter`
 * tags mark payoff cards (e.g. "whenever you gain life…"); all verified live.
 */
export const SECRET_THEMES: { tag: string; label: string }[] = [
  { tag: 'synergy-lifegain', label: 'lifegain' },
  { tag: 'counters-matter', label: '+1/+1 counters' },
  { tag: 'synergy-sacrifice', label: 'sacrifice' },
  { tag: 'synergy-token', label: 'tokens' },
  { tag: 'synergy-artifact', label: 'artifacts' },
  { tag: 'synergy-enchantment', label: 'enchantments' },
  { tag: 'synergy-equipment', label: 'Equipment' },
  { tag: 'synergy-aura', label: 'Auras' },
  { tag: 'synergy-vehicle', label: 'Vehicles' },
  { tag: 'synergy-instant', label: 'instants & sorceries' },
  { tag: 'lands-matter', label: 'lands & landfall' },
  { tag: 'synergy-mill', label: 'mill' },
  { tag: 'synergy-discard', label: 'discard' },
  { tag: 'draw-matters', label: 'card draw' },
  { tag: 'synergy-food', label: 'Food' },
  { tag: 'synergy-treasure', label: 'Treasure' },
  { tag: 'synergy-legendary', label: 'legends' },
  { tag: 'death-trigger', label: 'creatures dying' },
  { tag: 'attack-trigger', label: 'attacking' },
  { tag: 'cast-trigger', label: 'casting spells' },
  { tag: 'alternate-win-condition', label: 'an alternate win' },
]

/** Why a commander is suggested: it can search for the card, shares the strategy, or (fallback) just fits the colours. */
export type SuggestionReason = 'finds' | 'theme' | 'colours'

export interface SecretInfo {
  /** The strategy label, e.g. "lifegain". */
  theme: string
  /** Suggested commanders: ones that can search for the card first. */
  commanders: { card: ScryfallCard; reason: SuggestionReason }[]
  /** Tutors (in the deck's colours) that can find the card. */
  finders: ScryfallCard[]
  /** The deck's colours: what every suggested commander allows, so all suggestions stay legal. */
  identity: Colour[]
}

// --- Pure helpers (tested in secret.test.ts) ----------------------------------

const PERMANENT_TYPES = ['creature', 'artifact', 'enchantment', 'land', 'planeswalker', 'battle'] as const

const frontTypeLine = (card: ScryfallCard) => (card.type_line ?? card.card_faces?.[0]?.type_line ?? '').split(' // ')[0]
const fullText = (card: ScryfallCard) =>
  [card.oracle_text, ...(card.card_faces?.map((f) => f.oracle_text) ?? [])].filter(Boolean).join('\n')

/** The card's permanent types, e.g. ['artifact', 'creature']. */
export function cardTypes(card: ScryfallCard): string[] {
  const words = frontTypeLine(card).toLowerCase().split(/[\s—-]+/)
  return PERMANENT_TYPES.filter((t) => words.includes(t))
}

export interface SearchTarget {
  /** Alternatives, each a list of words: "an artifact or enchantment card" → [['artifact'], ['enchantment']]. */
  alternatives: string[][]
  /** What follows "card", e.g. "with mana value 3 or less" (empty if nothing). */
  condition: string
}

/** What a card's "search your library for …" text can find, one entry per search. */
export function searchTargets(text: string): SearchTarget[] {
  const searches: SearchTarget[] = []
  const pattern =
    /search(?:es)? (?:your|their) library(?: and\/or graveyard)? for (?:a|an|any number of|up to (?:one|two|three|four|five|x|\d+)|one|two|three) ((?:[\w'-]+,? )*?)cards?\b([^.;,]*)/gi
  for (const match of text.matchAll(pattern)) {
    const descriptor = match[1].trim().toLowerCase()
    const alternatives = descriptor
      ? descriptor.split(/,\s*(?:or\s+|and\/or\s+)?|\s+(?:or|and\/or)\s+/).map((alt) => alt.split(/\s+/).filter(Boolean))
      : [[]]
    searches.push({
      alternatives: alternatives.filter((alt) => alt.length > 0 || descriptor === ''),
      condition: match[2].trim().toLowerCase(),
    })
  }
  return searches
}

const NUMBER_WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }

/**
 * Does the card meet the condition after "card"? Mana value limits and
 * keywords ("with defender") are checked. Conditions that depend on the game
 * ("equal to …") are accepted, since you can set them up. Anything else
 * ("named …", "with the same name as …") is rejected.
 */
export function meetsCondition(condition: string, card: ScryfallCard): boolean {
  if (!condition) return true
  const mv = condition.match(/^with (?:mana value|converted mana cost) (\d+|[a-z]+) or (less|fewer|greater|more)\b/)
  if (mv) {
    const n = /^\d+$/.test(mv[1]) ? Number(mv[1]) : NUMBER_WORDS[mv[1]]
    if (n === undefined) return false
    return mv[2] === 'less' || mv[2] === 'fewer' ? card.cmc <= n : card.cmc >= n
  }
  if (/^with (?:mana value|converted mana cost) (?:equal to|less than or equal to|x)\b/.test(condition)) return true
  const keyword = condition.match(/^with ([a-z]+)$/)
  if (keyword) return (card.keywords ?? []).some((k) => k.toLowerCase() === keyword[1])
  return false
}

/**
 * Can this tutor find the secret card? True if one of its searches describes
 * the card: no words ("a card"), the card's types/subtypes ("an artifact card"),
 * or generic words that fit ("a nonland permanent card"), and the card meets
 * any condition after "card" (see meetsCondition).
 */
export function canFind(tutor: ScryfallCard, secret: ScryfallCard): boolean {
  const typeWords = new Set(frontTypeLine(secret).toLowerCase().split(/[\s—]+/).filter(Boolean))
  const types = cardTypes(secret)
  const generic: Record<string, boolean> = {
    permanent: types.length > 0,
    nonland: !types.includes('land'),
    noncreature: !types.includes('creature'),
    nonartifact: !types.includes('artifact'),
    nonenchantment: !types.includes('enchantment'),
    nonlegendary: !typeWords.has('legendary'),
    nonbasic: !typeWords.has('basic'),
  }
  return searchTargets(fullText(tutor)).some(
    ({ alternatives, condition }) =>
      meetsCondition(condition, secret) &&
      alternatives.some((words) => words.every((w) => typeWords.has(w) || generic[w] === true)),
  )
}

/** Colours every suggested commander allows. */
export function intersectIdentities(identities: Colour[][]): Colour[] {
  if (identities.length === 0) return []
  return sortColours(identities[0].filter((c) => identities.every((id) => id.includes(c))))
}

/** Colour rule for the secret card: it just has to fit inside the deck's colours. */
export function secretColourClause(filter: ColourFilter): string {
  if (filter.kind === 'any') return ''
  return colourClause({ kind: 'within', colours: filter.colours, includeColourless: true })
}

/** Scryfall tutor tags that could find a card with these types. */
export function tutorTagClause(types: string[]): string {
  const tags = ['tutor-card', 'tutor-permanent', ...types.filter((t) => t !== 'planeswalker' && t !== 'battle').map((t) => `tutor-${t}`)]
  return `(${tags.map((t) => `otag:${t}`).join(' or ')})`
}

/** Card type filter. For lands, skip double-faced cards (their land side is often the back). */
export const typeClause = (type: SecretType) => (type === 'any' ? '' : type === 'land' ? 't:land -is:dfc' : `t:${type}`)

/** The card challenges are built around: in secret mode, the secret card with the deck's colours. */
export const challengeCard = (result: GeneratedCommander): ScryfallCard =>
  result.secret ? { ...result.card, color_identity: result.secret.identity } : result.card

// --- Generation -------------------------------------------------------------------

const MAX_FINDING_COMMANDERS = 2
const MAX_COMMANDERS = 4
const MAX_FINDERS = 4

async function suggestCommanders(
  format: Format,
  colourFilter: ColourFilter,
  secret: ScryfallCard,
  themeTag: string,
  random: () => number,
): Promise<SecretInfo['commanders']> {
  const base = joinClauses(
    arenaClause(format),
    'is:brawler',
    colourClause(colourFilter),
    // The commander's colours must include the secret card's.
    secret.color_identity.length ? `id>=${identityCode(secret.color_identity)}` : '',
  )
  // 1. Commanders whose own text can search for the card.
  const tutoring = (await searchCards(joinClauses(base, tutorTagClause(cardTypes(secret))))).filter((c) => canFind(c, secret))
  const finds = shuffle(tutoring, random).slice(0, MAX_FINDING_COMMANDERS)
  // 2. Popular commanders that share the strategy.
  const taken = new Set(finds.map((c) => c.oracle_id))
  const themed = (await searchCards(joinClauses(base, `otag:${themeTag}`))).filter((c) => !taken.has(c.oracle_id))
  const theme = shuffle(themed.slice(0, 20), random).slice(0, MAX_COMMANDERS - finds.length)
  if (finds.length + theme.length > 0) {
    return [...finds.map((card) => ({ card, reason: 'finds' as const })), ...theme.map((card) => ({ card, reason: 'theme' as const }))]
  }
  // 3. Nobody searches for it or shares the strategy: popular commanders in its colours.
  const popular = await searchCards(base)
  return shuffle(popular.slice(0, 20), random)
    .slice(0, 3)
    .map((card) => ({ card, reason: 'colours' as const }))
}

async function suggestFinders(
  format: Format,
  identity: Colour[],
  secret: ScryfallCard,
  exclude: Set<string | undefined>,
  random: () => number,
): Promise<ScryfallCard[]> {
  const query = joinClauses(
    arenaClause(format),
    colourClause({ kind: 'within', colours: identity, includeColourless: true }),
    tutorTagClause(cardTypes(secret)),
  )
  const found = (await searchCards(query)).filter((c) => !exclude.has(c.oracle_id) && canFind(c, secret))
  // Results come most-played first: pick a few from the top.
  return shuffle(found.slice(0, 16), random).slice(0, MAX_FINDERS)
}

/**
 * A repeating effect ("whenever…", "at the beginning of…", "for each…"):
 * what makes a card an engine to build around, not a one-off or utility card.
 */
export const ENGINE_CLAUSE = '(o:whenever or o:"at the beginning" or o:"for each")'

/** Pick from this many of the most-played payoffs per strategy: the cards people actually build around. */
const TOP_BUILD_AROUNDS = 40

/** Roll a secret commander: the card, commanders that suit it, and ways to find it. */
export async function generateSecretCommander(settings: Settings, random: () => number = Math.random): Promise<GeneratedCommander> {
  const { format, colours, secret: secretSettings } = settings
  for (const colourFilter of colourFilterCandidates(colours, random)) {
    for (const theme of shuffle(SECRET_THEMES, random).slice(0, 5)) {
      const query = joinClauses(
        arenaClause(format),
        'is:permanent -t:legendary -t:basic -is:brawler',
        typeClause(secretSettings.type),
        secretColourClause(colourFilter),
        ENGINE_CLAUSE,
        `otag:${theme.tag}`,
      )
      // Search results come most-played first (EDHREC rank): pick one of the top build-arounds.
      const card = shuffle((await searchCards(query)).slice(0, TOP_BUILD_AROUNDS), random)[0]
      if (!card) continue
      const commanders = await suggestCommanders(format, colourFilter, card, theme.tag, random)
      if (commanders.length === 0) continue // nobody can lead this deck: try another card

      const identity = intersectIdentities(commanders.map((c) => c.card.color_identity))
      const exclude = new Set([card.oracle_id, ...commanders.map((c) => c.card.oracle_id)])
      const finders = await suggestFinders(format, identity, card, exclude, random)
      const restrictions = ['🤫 Secret commander', `Strategy: ${theme.label}`]
      if (secretSettings.type !== 'any') restrictions.push(`Secret card type: ${secretSettings.type}`)
      return { card, restrictions, secret: { theme: theme.label, commanders, finders, identity } }
    }
  }
  const type = secretSettings.type === 'any' ? '' : ` ${secretSettings.type}`
  throw new NoCommanderError(
    `Couldn’t find a secret${type} card with a matching commander for ${describeColourSettings(colours)}. Try other colours${type ? ' or another card type' : ''}.`,
  )
}
