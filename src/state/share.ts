// Share links: the commander, every rolled challenge and the sender's settings,
// packed into the URL hash (#share=…). The hash never reaches a server, so
// this works on any static host.

import type { ChaosPick } from '../challenges/chaos'
import { activeChallenges, defaultChallengeSettings } from '../challenges/conflicts'
import { runChallenges, type ChallengeRun } from '../challenges/engine'
import type { Generated, ParamValues } from '../challenges/types'
import type { GeneratedCommander } from '../generator/commander'
import type { ModifierId } from '../generator/modifiers'
import { getCardsByIds } from '../scryfall/client'
import { DEFAULT_SETTINGS, mergeWithDefaults, type Settings } from './settings'

/** One rolled challenge: id, parameters, and what it picked (choice and card ids). */
export interface SharedOutcome {
  i: string
  p: ParamValues
  c?: string
  k?: string[]
}

/** Kept short on purpose: it all goes in the URL. */
export interface SharePayload {
  v: 1
  /** Commander printing (Scryfall id). */
  c: string
  /** Commander restriction labels, e.g. "Creature type: Elf". */
  r: string[]
  /** The challenges that were rolled. */
  ch: SharedOutcome[]
  /** Chaos picks (commander modifiers and challenge ids). */
  x?: { m: ModifierId[]; c: string[] }
  /** The sender's settings, as a diff from the defaults. */
  s?: unknown
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Only the parts of `value` that differ from `defaults`, or undefined if nothing does. */
export function diffFromDefaults(defaults: unknown, value: unknown): unknown {
  if (isPlainObject(defaults) && isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      const d = diffFromDefaults(defaults[key], value[key])
      if (d !== undefined) out[key] = d
    }
    return Object.keys(out).length ? out : undefined
  }
  return JSON.stringify(defaults) === JSON.stringify(value) ? undefined : value
}

export function buildSharePayload(
  settings: Settings,
  commander: GeneratedCommander,
  run?: ChallengeRun,
  pick?: ChaosPick,
): SharePayload {
  const ch = (run?.outcomes ?? []).map((o): SharedOutcome => {
    const out: SharedOutcome = { i: o.id, p: o.params }
    if (o.generated?.choice) out.c = o.generated.choice
    if (o.generated?.cards?.length) out.k = o.generated.cards.map((c) => c.id)
    return out
  })
  const payload: SharePayload = { v: 1, c: commander.card.id, r: commander.restrictions, ch }
  if (pick) payload.x = { m: pick.modifiers, c: pick.challenges }
  const s = diffFromDefaults(DEFAULT_SETTINGS, settings)
  if (s !== undefined) payload.s = s
  return payload
}

// --- Encoding (base64url of UTF-8 JSON) ------------------------------------

export function encodeShare(payload: SharePayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a share string; undefined if it's damaged or not one of ours. */
export function decodeShare(encoded: string): SharePayload | undefined {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    const json = new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)))
    const p = JSON.parse(json) as SharePayload
    const valid =
      p?.v === 1 &&
      typeof p.c === 'string' &&
      Array.isArray(p.r) &&
      Array.isArray(p.ch) &&
      p.ch.every((o) => typeof o?.i === 'string' && isPlainObject(o.p))
    return valid ? p : undefined
  } catch {
    return undefined
  }
}

export const SHARE_PREFIX = '#share='

export function shareUrl(payload: SharePayload, base = window.location.origin + window.location.pathname): string {
  return `${base}${SHARE_PREFIX}${encodeShare(payload)}`
}

export function readShareFromHash(hash: string): SharePayload | undefined {
  return hash.startsWith(SHARE_PREFIX) ? decodeShare(hash.slice(SHARE_PREFIX.length)) : undefined
}

/** The sender's settings, filled in with defaults. */
export function settingsFromShare(payload: SharePayload): Settings {
  return mergeWithDefaults(DEFAULT_SETTINGS, payload.s ?? {})
}

// --- Loading ------------------------------------------------------------------

/**
 * Rebuild a shared (or saved) challenge: fetch the exact cards in one request,
 * then re-run the challenges keeping everything that was rolled, which just
 * re-checks the pool sizes (those counts are cached).
 */
export async function loadSharedChallenge(
  payload: SharePayload,
): Promise<{ commander: GeneratedCommander; run?: ChallengeRun; pick?: ChaosPick }> {
  const cards = await getCardsByIds([payload.c, ...payload.ch.flatMap((o) => o.k ?? [])])
  const byId = new Map(cards.map((c) => [c.id, c]))
  const card = byId.get(payload.c)
  if (!card) throw new Error('This commander couldn’t be found on Scryfall any more.')

  const commander: GeneratedCommander = { card, restrictions: payload.r }
  const pick = payload.x ? { modifiers: payload.x.m, challenges: payload.x.c } : undefined
  if (payload.ch.length === 0) return { commander, pick }

  const challenges = defaultChallengeSettings()
  for (const o of payload.ch) if (challenges[o.i]) challenges[o.i] = { enabled: true, params: o.p }
  const settings = { ...settingsFromShare(payload), challenges }

  const previous: ChallengeRun = {
    outcomes: activeChallenges(challenges).map(({ def, params }) => {
      const shared = payload.ch.find((o) => o.i === def.id)
      const sharedCards = shared?.k?.map((id) => byId.get(id)).filter((c) => c !== undefined) ?? []
      const generated: Generated | undefined =
        shared?.c || sharedCards.length
          ? { choice: shared?.c, cards: sharedCards.length ? sharedCards : undefined }
          : undefined
      return { id: def.id, params, summary: '', generated }
    }),
  }
  const run = await runChallenges(settings, card, { previous })
  return { commander, run, pick }
}
