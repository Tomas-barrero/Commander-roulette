import { CHALLENGES } from './definitions'
import type { ChallengeDefinition, ParamValues } from './types'

/** Saved per-challenge settings: on/off and parameter values. */
export type ChallengeSettings = Record<string, { enabled: boolean; params: ParamValues }>

export function defaultParams(def: ChallengeDefinition): ParamValues {
  return Object.fromEntries((def.params ?? []).map((p) => [p.key, p.default]))
}

export function defaultChallengeSettings(defs: ChallengeDefinition[] = CHALLENGES): ChallengeSettings {
  return Object.fromEntries(defs.map((d) => [d.id, { enabled: false, params: defaultParams(d) }]))
}

/** Conflicts in both directions: A conflicts with B if either one declares it. */
export function conflictsOf(id: string, defs: ChallengeDefinition[] = CHALLENGES): string[] {
  const own = defs.find((d) => d.id === id)?.conflictsWith ?? []
  const declaredByOthers = defs.filter((d) => d.conflictsWith?.includes(id)).map((d) => d.id)
  return [...new Set([...own, ...declaredByOthers])]
}

/** The enabled challenge that stops `id` from being turned on, if any. */
export function blockedBy(
  id: string,
  settings: ChallengeSettings,
  defs: ChallengeDefinition[] = CHALLENGES,
): ChallengeDefinition | undefined {
  const conflicts = conflictsOf(id, defs)
  return defs.find((d) => conflicts.includes(d.id) && settings[d.id]?.enabled)
}

/**
 * The challenges to run, in definition order. If two conflicting challenges
 * are somehow both on (e.g. old saved settings), the first one wins.
 */
export function activeChallenges(
  settings: ChallengeSettings,
  defs: ChallengeDefinition[] = CHALLENGES,
): { def: ChallengeDefinition; params: ParamValues }[] {
  const active: { def: ChallengeDefinition; params: ParamValues }[] = []
  for (const def of defs) {
    const s = settings[def.id]
    if (!s?.enabled) continue
    const conflicts = conflictsOf(def.id, defs)
    if (active.some((a) => conflicts.includes(a.def.id))) continue
    active.push({ def, params: { ...defaultParams(def), ...s.params } })
  }
  return active
}
