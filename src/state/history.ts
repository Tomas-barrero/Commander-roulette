import { useEffect, useState } from 'react'
import type { Colour } from '../scryfall/types'
import type { SharePayload } from './share'

/** A saved roll: enough to show a thumbnail, plus the share payload to reopen it. */
export interface HistoryEntry {
  /** Stays the same while you reroll challenges for the same commander. */
  key: string
  at: number
  name: string
  image?: string
  identity: Colour[]
  share: SharePayload
}

export const HISTORY_LIMIT = 20
export const FAVOURITES_LIMIT = 100

/** Put an entry at the top, replacing any older version with the same key. */
export function upsertEntry(list: HistoryEntry[], entry: HistoryEntry, limit: number): HistoryEntry[] {
  return [entry, ...list.filter((e) => e.key !== entry.key)].slice(0, limit)
}

export const sameShare = (a: SharePayload, b: SharePayload) => JSON.stringify(a) === JSON.stringify(b)

const isEntry = (e: unknown): e is HistoryEntry =>
  typeof e === 'object' && e !== null && typeof (e as HistoryEntry).key === 'string' && typeof (e as HistoryEntry).share === 'object'

function load(key: string): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

/** A list of entries persisted to localStorage. */
export function useEntryList(storageKey: string) {
  const [list, setList] = useState<HistoryEntry[]>(() => load(storageKey))
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(list))
    } catch {
      // Storage full or blocked: the list just won't persist
    }
  }, [storageKey, list])
  return [list, setList] as const
}
