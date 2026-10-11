// Chaos mode: switch on N random challenges (commander modifiers and deck
// challenges) on every roll, on top of whatever is already on.

import { generateCommander, NoCommanderError, type GeneratedCommander } from '../generator/commander'
import { MODIFIER_INFO, modifierConflict, type Difficulty, type ModifierId } from '../generator/modifiers'
import type { ScryfallCard } from '../scryfall/types'
import type { Settings } from '../state/settings'
import { blockedBy, conflictsOf } from './conflicts'
import { CHALLENGES, CHALLENGES_BY_ID } from './definitions'
import { isBroken, runChallenges, type ChallengeRun } from './engine'
import { poolMode } from './types'

export type ChaosDifficulty = 'easy' | 'mixed' | 'hard'

export interface ChaosSettings {
  enabled: boolean
  /** How many random challenges to add. */
  count: number
  /** Weights picks towards easy or hard challenges. */
  difficulty: ChaosDifficulty
}

export const DEFAULT_CHAOS: ChaosSettings = { enabled: false, count: 3, difficulty: 'mixed' }

const WEIGHTS: Record<ChaosDifficulty, Record<Difficulty, number>> = {
  easy: { 1: 6, 2: 3, 3: 1 },
  mixed: { 1: 1, 2: 1, 3: 1 },
  hard: { 1: 1, 2: 3, 3: 6 },
}

/** Commander modifiers chaos mode can switch on (with their saved parameters). */
export const CHAOS_MODIFIERS: ModifierId[] = ['rarity', 'hipster', 'manaValue', 'tribe', 'era', 'tiny']

/** What chaos mode switched on for this roll. */
export interface ChaosPick {
  modifiers: ModifierId[]
  challenges: string[]
}

export interface ChaosCandidate {
  kind: 'modifier' | 'challenge'
  id: string
  difficulty: Difficulty
}

/** Everything chaos mode could switch on that isn't already on (or blocked by something that is). */
export function chaosCandidates(settings: Settings, kinds: ChaosCandidate['kind'][] = ['modifier', 'challenge']): ChaosCandidate[] {
  const out: ChaosCandidate[] = []
  if (kinds.includes('modifier')) {
    for (const info of MODIFIER_INFO) {
      const value = settings.modifiers[info.id]
      if (!CHAOS_MODIFIERS.includes(info.id) || typeof value !== 'object' || ('enabled' in value && value.enabled)) continue
      if (modifierConflict(info.id, settings.modifiers)) continue
      out.push({ kind: 'modifier', id: info.id, difficulty: info.difficulty })
    }
  }
  if (kinds.includes('challenge')) {
    for (const def of CHALLENGES) {
      if (settings.challenges[def.id]?.enabled || blockedBy(def.id, settings.challenges)) continue
      out.push({ kind: 'challenge', id: def.id, difficulty: def.difficulty })
    }
  }
  return out
}

/**
 * Pick up to `count` candidates at random, weighted by the difficulty dial,
 * never picking two challenges that conflict with each other.
 */
export function pickChaos(
  candidates: ChaosCandidate[],
  count: number,
  difficulty: ChaosDifficulty,
  random: () => number = Math.random,
  exclude: Set<string> = new Set(),
): ChaosCandidate[] {
  const picked: ChaosCandidate[] = []
  while (picked.length < count) {
    const blocked = new Set(picked.filter((p) => p.kind === 'challenge').flatMap((p) => conflictsOf(p.id)))
    const pool = candidates.filter((c) => !exclude.has(c.id) && !picked.includes(c) && !blocked.has(c.id))
    if (pool.length === 0) break
    const total = pool.reduce((sum, c) => sum + WEIGHTS[difficulty][c.difficulty], 0)
    let roll = random() * total
    const choice = pool.find((c) => (roll -= WEIGHTS[difficulty][c.difficulty]) < 0) ?? pool[pool.length - 1]
    picked.push(choice)
  }
  return picked
}

/** The settings with the chaos picks switched on. */
export function applyChaos(settings: Settings, pick: ChaosPick): Settings {
  const modifiers = { ...settings.modifiers }
  for (const id of pick.modifiers) modifiers[id] = { ...(modifiers[id] as object), enabled: true } as never
  const challenges = { ...settings.challenges }
  for (const id of pick.challenges) challenges[id] = { ...challenges[id], enabled: true }
  return { ...settings, modifiers, challenges }
}

/**
 * A fresh random pick. Pass `keepModifiers` when the commander is locked:
 * its modifiers stay and only deck challenges are re-picked.
 */
export function newChaosPick(settings: Settings, random: () => number = Math.random, keepModifiers?: ModifierId[]): ChaosPick {
  const { count, difficulty } = settings.chaos
  if (keepModifiers) {
    const picks = pickChaos(chaosCandidates(settings, ['challenge']), Math.max(0, count - keepModifiers.length), difficulty, random)
    return { modifiers: keepModifiers, challenges: picks.map((p) => p.id) }
  }
  const picks = pickChaos(chaosCandidates(settings), count, difficulty, random)
  return {
    modifiers: picks.filter((p) => p.kind === 'modifier').map((p) => p.id as ModifierId),
    challenges: picks.filter((p) => p.kind === 'challenge').map((p) => p.id),
  }
}

/** Generate a commander, with chaos modifiers if chaos mode is on. Re-picks if they make it impossible. */
export async function generateCommanderWithChaos(
  settings: Settings,
  random: () => number = Math.random,
): Promise<{ commander: GeneratedCommander; pick?: ChaosPick }> {
  if (!settings.chaos.enabled) return { commander: await generateCommander(settings) }
  for (let attempt = 0; ; attempt++) {
    // After a few impossible combinations, fall back to deck challenges only.
    const pick = attempt < 3 ? newChaosPick(settings, random) : newChaosPick(settings, random, [])
    try {
      return { commander: await generateCommander(applyChaos(settings, pick)), pick }
    } catch (e) {
      if (!(e instanceof NoCommanderError) || attempt >= 3) throw e
    }
  }
}

/**
 * Run challenges, including chaos picks. Any chaos challenge that's skipped,
 * fails, or leaves too small a pool is swapped for another random one.
 * `swap` swaps one chaos challenge on request.
 */
export async function runChallengesWithChaos(
  settings: Settings,
  commander: ScryfallCard,
  options: { pick?: ChaosPick; previous?: ChallengeRun; reroll?: string; swap?: string; random?: () => number } = {},
): Promise<{ run: ChallengeRun; pick?: ChaosPick }> {
  const { previous, reroll, random = Math.random } = options
  if (!options.pick) return { run: await runChallenges(settings, commander, { previous, reroll, random }) }

  let pick = options.pick
  const tried = new Set(pick.challenges)
  const replace = (id: string) => {
    const others = { ...pick, challenges: pick.challenges.filter((c) => c !== id) }
    const [next] = pickChaos(chaosCandidates(applyChaos(settings, others), ['challenge']), 1, settings.chaos.difficulty, random, tried)
    if (next) tried.add(next.id)
    pick = { ...others, challenges: next ? [...others.challenges, next.id] : others.challenges }
  }

  if (options.swap) replace(options.swap)
  let run = await runChallenges(applyChaos(settings, pick), commander, { previous, reroll, random })

  const drop = (id: string) => (pick = { ...pick, challenges: pick.challenges.filter((c) => c !== id) })

  // Swap broken picks a few times; if that doesn't fix it, drop them. Better
  // fewer challenges than one you can't build.
  for (let round = 0; round < SWAP_ROUNDS + 2; round++) {
    const broken = brokenChaosPicks(run, pick)
    if (broken.length === 0) break
    broken.forEach(round < SWAP_ROUNDS ? replace : drop)
    run = await runChallenges(applyChaos(settings, pick), commander, { previous: run, random })
  }
  return { run, pick }
}

const SWAP_ROUNDS = 2

/** Chaos picks that need replacing: broken ones, or the main suspect if the combined pool is too small. */
function brokenChaosPicks(run: ChallengeRun, pick: ChaosPick): string[] {
  const broken = run.outcomes.filter((o) => pick.challenges.includes(o.id) && isBroken(o)).map((o) => o.id)
  if (broken.length > 0 || run.combined?.level !== 'too-small') return broken
  // Each rule is fine alone but together they're too much: blame the chaos
  // "every nonland card" rule with the smallest pool of its own.
  const suspects = run.outcomes.filter(
    (o) => pick.challenges.includes(o.id) && poolMode(CHALLENGES_BY_ID[o.id], o.params) === 'nonland' && o.pools?.length,
  )
  suspects.sort((a, b) => a.pools![0].count - b.pools![0].count)
  return suspects.length ? [suspects[0].id] : []
}
