import { describe, expect, it } from 'vitest'
import { activeChallenges, blockedBy, conflictsOf, defaultChallengeSettings, type ChallengeSettings } from './conflicts'

const enable = (...ids: string[]): ChallengeSettings => {
  const s = defaultChallengeSettings()
  for (const id of ids) s[id] = { ...s[id], enabled: true }
  return s
}

describe('conflicts', () => {
  it('are symmetric', () => {
    expect(conflictsOf('creatureless')).toContain('tribal')
    expect(conflictsOf('tribal')).toContain('creatureless')
    expect(conflictsOf('creatures-lands-only')).toContain('creatureless')
  })

  it('blockedBy names the enabled conflicting challenge', () => {
    expect(blockedBy('tribal', enable('creatureless'))?.id).toBe('creatureless')
    expect(blockedBy('tribal', enable('no-ramp'))).toBeUndefined()
  })

  it('activeChallenges keeps the first of two conflicting challenges', () => {
    const ids = activeChallenges(enable('tribal', 'creatureless', 'no-ramp')).map((a) => a.def.id)
    expect(ids).toEqual(['creatureless', 'no-ramp'])
  })

  it('fills in missing parameters with defaults', () => {
    const s = enable('random-includes')
    s['random-includes'].params = {}
    expect(activeChallenges(s)[0].params).toEqual({ count: 3 })
  })
})
