import { countCards, ScryfallError } from '../scryfall/client'
import { joinClauses } from '../scryfall/query'
import type { ScryfallCard } from '../scryfall/types'
import type { Settings } from '../state/settings'
import { activeChallenges } from './conflicts'
import { NoCardsError } from './draw'
import {
  deckBaseQuery,
  feasibility,
  NONLAND_TARGET,
  nonlandPoolQuery,
  quotaPoolQuery,
  type FeasibilityLevel,
} from './feasibility'
import type { ChallengeContext, ChallengeDefinition, Generated, ParamValues } from './types'

export interface PoolCheck {
  query: string
  count: number
  needed: number
  level: FeasibilityLevel
}

export interface ChallengeOutcome {
  id: string
  params: ParamValues
  summary: string
  generated?: Generated
  /** The challenge doesn't fit this commander, so it was skipped. */
  skipped?: string
  /** Generation failed, e.g. no cards matched. */
  error?: string
  pool?: PoolCheck
}

export interface ChallengeRun {
  outcomes: ChallengeOutcome[]
  /** All "every nonland card must…" rules together (only when there are 2+). */
  combined?: PoolCheck
}

const sameParams = (a: ParamValues, b: ParamValues) => JSON.stringify(a) === JSON.stringify(b)

async function checkPool(query: string, needed: number): Promise<PoolCheck> {
  const count = await countCards(query)
  return { query, count, needed, level: feasibility(count, needed) }
}

/**
 * Run every active challenge for a commander: pick must-include cards and
 * random choices, then check pool sizes.
 *
 * Pass `previous` to keep earlier results: every challenge whose parameters
 * haven't changed keeps its cards/choice, except `reroll` (one challenge id).
 */
export async function runChallenges(
  settings: Settings,
  commander: ScryfallCard,
  { previous, reroll, random = Math.random }: { previous?: ChallengeRun; reroll?: string; random?: () => number } = {},
): Promise<ChallengeRun> {
  const active = activeChallenges(settings.challenges)
  const deckBase = deckBaseQuery(settings.format, commander.color_identity)
  const ctx: ChallengeContext = {
    format: settings.format,
    commander,
    deckBase,
    restrictions: '',
    taken: new Set(commander.oracle_id ? [commander.oracle_id] : []),
    random,
  }

  // Results we can keep from last time. Their cards are reserved first so new draws can't repeat them.
  const kept = new Map<string, Generated>()
  for (const { def, params } of active) {
    const prev = previous?.outcomes.find((o) => o.id === def.id)
    if (prev?.generated && !prev.error && def.id !== reroll && sameParams(prev.params, params)) {
      kept.set(def.id, prev.generated)
      prev.generated.cards?.forEach((c) => c.oracle_id && ctx.taken.add(c.oracle_id))
    }
  }

  const outcomes = new Map<string, ChallengeOutcome>()

  async function run(def: ChallengeDefinition, params: ParamValues) {
    const outcome: ChallengeOutcome = { id: def.id, params, summary: def.summary(params, undefined) }
    outcomes.set(def.id, outcome)
    outcome.skipped = def.unavailable?.(params, ctx)
    if (outcome.skipped) return
    try {
      outcome.generated = kept.get(def.id) ?? (def.generate ? await def.generate(params, ctx) : undefined)
      outcome.summary = def.summary(params, outcome.generated)
    } catch (e) {
      if (e instanceof NoCardsError) outcome.error = e.message
      else if (e instanceof ScryfallError && e.status === 404) outcome.error = 'Nothing on Arena matches this.'
      else throw e
    }
  }

  // 1. "Every nonland card must…" rules first: together they form the restrictions
  //    that every generated card has to obey.
  for (const { def, params } of active.filter((a) => a.def.pool === 'nonland')) await run(def, params)
  const fragmentOf = (def: ChallengeDefinition) => {
    const o = outcomes.get(def.id)
    return o && !o.skipped && !o.error ? def.buildQueryFragment?.(o.params, o.generated) : undefined
  }
  const nonlandFragments = active.filter((a) => a.def.pool === 'nonland').map((a) => fragmentOf(a.def))
  ctx.restrictions = joinClauses(...nonlandFragments)

  // 2. Everything else (must-includes, quotas, honour rules).
  for (const { def, params } of active.filter((a) => a.def.pool !== 'nonland')) await run(def, params)

  // 3. Pool sizes.
  const target = NONLAND_TARGET[settings.format]
  for (const { def, params } of active) {
    const fragment = fragmentOf(def)
    const outcome = outcomes.get(def.id)!
    if (!fragment) continue
    if (def.pool === 'nonland') outcome.pool = await checkPool(nonlandPoolQuery(deckBase, fragment), target)
    if (def.pool === 'quota') {
      outcome.pool = await checkPool(quotaPoolQuery(deckBase, ctx.restrictions, fragment), def.quota?.(params) ?? 1)
    }
  }
  const combined =
    nonlandFragments.filter(Boolean).length >= 2
      ? await checkPool(nonlandPoolQuery(deckBase, ctx.restrictions), target)
      : undefined

  return { outcomes: active.map((a) => outcomes.get(a.def.id)!), combined }
}
