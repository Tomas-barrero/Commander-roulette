import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, mergeWithDefaults } from './settings'

describe('mergeWithDefaults', () => {
  it('returns defaults for garbage', () => {
    expect(mergeWithDefaults(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS)
    expect(mergeWithDefaults(DEFAULT_SETTINGS, 'nope')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps saved values and fills in missing ones', () => {
    const merged = mergeWithDefaults(DEFAULT_SETTINGS, {
      format: 'standardbrawl',
      modifiers: { hipster: { enabled: true } },
    })
    expect(merged.format).toBe('standardbrawl')
    expect(merged.modifiers.hipster).toEqual({ enabled: true, minRank: DEFAULT_SETTINGS.modifiers.hipster.minRank })
    expect(merged.modifiers.tiny).toEqual(DEFAULT_SETTINGS.modifiers.tiny)
    expect(merged.colours).toEqual(DEFAULT_SETTINGS.colours)
  })

  it('drops unknown keys and wrongly typed values', () => {
    const merged = mergeWithDefaults(DEFAULT_SETTINGS, {
      oldSetting: true,
      modifiers: { hipster: { enabled: 'yes', minRank: 5000 } },
      colours: { manual: { colours: 'WU' } },
    })
    expect(merged).not.toHaveProperty('oldSetting')
    expect(merged.modifiers.hipster).toEqual({ enabled: false, minRank: 5000 })
    expect(merged.colours.manual.colours).toEqual(DEFAULT_SETTINGS.colours.manual.colours)
  })
})
