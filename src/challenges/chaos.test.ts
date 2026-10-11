import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '../state/settings'
import { applyChaos, chaosCandidates, newChaosPick, pickChaos, type ChaosCandidate } from './chaos'
import { conflictsOf, defaultChallengeSettings } from './conflicts'

/** A predictable "random" sequence. */
function seeded(seed = 1) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

const withChallenges = (...ids: string[]): Settings => {
  const challenges = defaultChallengeSettings()
  for (const id of ids) challenges[id] = { ...challenges[id], enabled: true }
  return { ...DEFAULT_SETTINGS, challenges }
}

describe('chaosCandidates', () => {
  it('includes commander modifiers and deck challenges', () => {
    const kinds = new Set(chaosCandidates(DEFAULT_SETTINGS).map((c) => c.kind))
    expect(kinds).toEqual(new Set(['modifier', 'challenge']))
  })

  it('skips things already on, and things they block', () => {
    const ids = chaosCandidates(withChallenges('creatureless')).map((c) => c.id)
    expect(ids).not.toContain('creatureless')
    expect(ids).not.toContain('tribal')
  })
})

describe('pickChaos', () => {
  const candidates = chaosCandidates(DEFAULT_SETTINGS)

  it('picks the requested number, with no repeats or conflicts', () => {
    for (let seed = 1; seed < 50; seed++) {
      const picks = pickChaos(candidates, 6, 'mixed', seeded(seed))
      expect(picks).toHaveLength(6)
      expect(new Set(picks.map((p) => p.id)).size).toBe(6)
      for (const p of picks) for (const other of conflictsOf(p.id)) expect(picks.map((x) => x.id)).not.toContain(other)
    }
  })

  it('stops when it runs out of candidates', () => {
    const few: ChaosCandidate[] = [{ kind: 'challenge', id: 'no-ramp', difficulty: 1 }]
    expect(pickChaos(few, 3, 'mixed')).toHaveLength(1)
  })

  it('the difficulty dial shifts picks towards hard or easy challenges', () => {
    const average = (dial: 'easy' | 'hard') => {
      const random = seeded(7)
      let total = 0
      for (let i = 0; i < 300; i++) total += pickChaos(candidates, 1, dial, random)[0].difficulty
      return total / 300
    }
    expect(average('hard')).toBeGreaterThan(average('easy') + 0.4)
  })

  it('respects the exclude list', () => {
    const picks = pickChaos(candidates, 100, 'mixed', seeded(3), new Set(['no-ramp']))
    expect(picks.map((p) => p.id)).not.toContain('no-ramp')
  })
})

describe('applyChaos / newChaosPick', () => {
  it('switches the picks on without touching saved parameters', () => {
    const applied = applyChaos(DEFAULT_SETTINGS, { modifiers: ['hipster'], challenges: ['lipogram'] })
    expect(applied.modifiers.hipster).toEqual({ ...DEFAULT_SETTINGS.modifiers.hipster, enabled: true })
    expect(applied.challenges.lipogram.enabled).toBe(true)
    expect(DEFAULT_SETTINGS.challenges.lipogram.enabled).toBe(false)
  })

  it('keeps the commander modifiers when the commander is locked', () => {
    const settings = { ...DEFAULT_SETTINGS, chaos: { enabled: true, count: 4, difficulty: 'mixed' as const } }
    const pick = newChaosPick(settings, seeded(5), ['tiny'])
    expect(pick.modifiers).toEqual(['tiny'])
    expect(pick.challenges).toHaveLength(3)
  })
})
