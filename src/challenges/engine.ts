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
import { poolMode, type ChallengeContext, type ChallengeDefinition, type Generated, type ParamValues } from './types'

export interface PoolCheck {
  /** What's being counted, for rules with several checks (e.g. "Elf creatures"). */
  label?: string
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
  pools?: PoolCheck[]
}

export interface ChallengeRun {
  outcomes: ChallengeOutcome[]
  /** All "every nonland card must…" rules together (only when there are 2+). */
  combined?: PoolCheck
}

/** Is this outcome unusable: skipped, failed, or with a pool too small to build? */
export const isBroken = (o: ChallengeOutcome) =>
  !!o.skipped || !!o.error || !!o.pools?.some((p) => p.level === 'too-small')

const sameParams = (a: ParamValues, b: ParamValues) => JSON.stringify(a) === JSON.stringify(b)

async function checkPool(query: string, needed: number, label?: string): Promise<PoolCheck> {
  const count = await countCards(query)
  return { label, query, count, needed, level: feasibility(count, needed) }
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
  const target = NONLAND_TARGET[settings.format]
  const ctx: ChallengeContext = {
    format: settings.format,
    nonlandTarget: target,
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

  const isNonland = (a: (typeof active)[number]) => poolMode(a.def, a.params) === 'nonland'
  const usable = (o?: ChallengeOutcome): o is ChallengeOutcome => !!o && !o.skipped && !o.error

  // 1. "Every nonland card must…" rules first: together they form the restrictions
  //    that every generated card has to obey.
  for (const { def, params } of active.filter(isNonland)) await run(def, params)
  const nonlandFragments = active.filter(isNonland).map(({ def }) => {
    const o = outcomes.get(def.id)
    return usable(o) ? def.buildQueryFragment?.(o.params, o.generated) : undefined
  })
  ctx.restrictions = joinClauses(...nonlandFragments)

  // 2. Everything else (must-includes, quotas, other rules).
  for (const { def, params } of active.filter((a) => !isNonland(a))) await run(def, params)

  // 3. Pool sizes (all counted in parallel; the client still spaces the requests).
  const checks: Promise<unknown>[] = []
  for (const a of active) {
    const o = outcomes.get(a.def.id)
    if (!usable(o)) continue
    if (isNonland(a)) {
      const fragment = a.def.buildQueryFragment?.(o.params, o.generated)
      if (fragment) checks.push(checkPool(nonlandPoolQuery(deckBase, fragment), target).then((p) => (o.pools = [p])))
    } else if (a.def.quotas) {
      const quotas = a.def.quotas(o.params, o.generated, settings.format)
      const restrictions = (q: (typeof quotas)[number]) => (q.lands ? '' : ctx.restrictions)
      checks.push(
        Promise.all(quotas.map((q) => checkPool(quotaPoolQuery(deckBase, restrictions(q), q.fragment), q.needed, q.label))).then(
          (pools) => (o.pools = pools),
        ),
      )
    }
  }
  const combinedCheck =
    nonlandFragments.filter(Boolean).length >= 2 ? checkPool(nonlandPoolQuery(deckBase, ctx.restrictions), target) : undefined
  await Promise.all(checks)
  const combined = await combinedCheck

  return { outcomes: active.map((a) => outcomes.get(a.def.id)!), combined }
}
