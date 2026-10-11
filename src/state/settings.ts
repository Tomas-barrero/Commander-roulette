import { useEffect, useState } from 'react'
import { DEFAULT_CHAOS, type ChaosSettings } from '../challenges/chaos'
import { defaultChallengeSettings, type ChallengeSettings } from '../challenges/conflicts'
import { DEFAULT_COLOUR_SETTINGS, type ColourSettings } from '../generator/colours'
import { DEFAULT_MODIFIERS, type CommanderModifiers } from '../generator/modifiers'
import { DEFAULT_SECRET, type SecretSettings } from '../generator/secret'
import type { Format } from '../scryfall/types'

export interface Settings {
  format: Format
  colours: ColourSettings
  modifiers: CommanderModifiers
  challenges: ChallengeSettings
  chaos: ChaosSettings
  secret: SecretSettings
}

export const DEFAULT_SETTINGS: Settings = {
  format: 'brawl',
  colours: DEFAULT_COLOUR_SETTINGS,
  modifiers: DEFAULT_MODIFIERS,
  challenges: defaultChallengeSettings(),
  chaos: DEFAULT_CHAOS,
  secret: DEFAULT_SECRET,
}

const STORAGE_KEY = 'commander-roulette:settings'

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Overlay saved values onto defaults. Only keys that exist in the defaults
 * are kept, and only if they have the same type, so settings saved by an
 * older version (or hand-edited) can't break the app.
 */
export function mergeWithDefaults<T>(defaults: T, saved: unknown): T {
  if (isPlainObject(defaults)) {
    if (!isPlainObject(saved)) return defaults
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(defaults)) out[key] = mergeWithDefaults(defaults[key], saved[key])
    return out as T
  }
  if (Array.isArray(defaults)) return (Array.isArray(saved) ? saved : defaults) as T
  return (typeof saved === typeof defaults ? saved : defaults) as T
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? mergeWithDefaults(DEFAULT_SETTINGS, JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** App settings, persisted to localStorage on every change. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Storage full or blocked: settings just won't persist
    }
  }, [settings])
  return [settings, setSettings] as const
}
