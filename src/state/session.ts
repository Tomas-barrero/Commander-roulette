import { useEffect, useState } from 'react'

const PREFIX = 'commander-roulette:session:'

function read<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : initial
  } catch {
    return initial
  }
}

/**
 * useState backed by sessionStorage: survives a page reload but not closing
 * the tab. Used for the reroll budget and the current commander.
 */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial))
  useEffect(() => {
    try {
      if (value === undefined) sessionStorage.removeItem(PREFIX + key)
      else sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // ignore: the value just won't survive a reload
    }
  }, [key, value])
  return [value, setValue] as const
}
