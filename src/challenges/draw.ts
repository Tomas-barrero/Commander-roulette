import { loadCreatureTypes } from '../scryfall/catalog'
import { countCards, getRandomCard, ScryfallError } from '../scryfall/client'
import { joinClauses } from '../scryfall/query'
import type { ScryfallCard } from '../scryfall/types'
import { shuffle } from '../generator/colours'
import { creatureTypes } from '../generator/modifiers'
import type { ChallengeContext } from './types'

/** Thrown when a challenge can't find any card to generate. */
export class NoCardsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoCardsError'
  }
}

const is404 = (e: unknown) => e instanceof ScryfallError && e.status === 404

/** The full query for a deck card: Arena + format + identity + fragment, minus cards already used. */
export function deckCardQuery(ctx: ChallengeContext, fragment: string, { withRestrictions = true } = {}): string {
  const exclusions = [...ctx.taken].map((id) => `-oracleid:${id}`)
  return joinClauses(ctx.deckBase, fragment, withRestrictions && ctx.restrictions, ...exclusions)
}

/**
 * Draw up to `count` different random cards matching a fragment. Each one is
 * added to `ctx.taken` so later draws (and other challenges) don't repeat it.
 */
export async function drawCards(
  ctx: ChallengeContext,
  fragment: string,
  count: number,
  options?: { withRestrictions?: boolean },
): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = []
  while (cards.length < count) {
    try {
      const card = await getRandomCard(deckCardQuery(ctx, fragment, options))
      if (card.oracle_id) ctx.taken.add(card.oracle_id)
      cards.push(card)
    } catch (e) {
      if (is404(e)) break // the pool ran out
      throw e
    }
  }
  if (cards.length === 0) throw new NoCardsError('No Arena cards in your commander’s colours match this (with your other rules).')
  return cards
}

/** Try fragments in order and draw one card from the first that has any. */
export async function drawOneOf(ctx: ChallengeContext, fragments: string[]): Promise<ScryfallCard> {
  for (const fragment of fragments) {
    try {
      return (await drawCards(ctx, fragment, 1))[0]
    } catch (e) {
      if (!(e instanceof NoCardsError)) throw e
    }
  }
  throw new NoCardsError('No Arena cards in your commander’s colours match this (with your other rules).')
}

/**
 * Shuffle the options, count the pool for up to `maxTries` of them (in
 * parallel), and return the first with at least `needed` cards. If none has
 * enough, return the biggest, so the pool check can flag it as too small.
 */
export async function pickFeasible<T>(
  ctx: ChallengeContext,
  options: T[],
  queryFor: (option: T) => string,
  needed: number,
  maxTries = 8,
): Promise<T> {
  const tries = shuffle(options, ctx.random).slice(0, maxTries)
  if (tries.length === 0) throw new NoCardsError('Nothing to choose from.')
  const counts = await Promise.all(tries.map((option) => countCards(queryFor(option))))
  const enough = tries.find((_option, i) => counts[i] >= needed)
  return enough ?? tries[counts.indexOf(Math.max(...counts))]
}

/** Creature types of a card, using Scryfall's creature-type catalog. */
export async function cardCreatureTypes(card: ScryfallCard): Promise<string[]> {
  return creatureTypes(card.type_line ?? card.card_faces?.[0]?.type_line ?? '', await loadCreatureTypes())
}

/** Does the card have this Scryfall function tag? (Cached for 24h.) */
export async function hasTag(card: ScryfallCard, tag: string): Promise<boolean> {
  return !!card.oracle_id && (await countCards(`oracleid:${card.oracle_id} otag:${tag}`)) > 0
}
