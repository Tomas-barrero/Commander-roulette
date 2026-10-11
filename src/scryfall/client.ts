import type { ScryfallCard, ScryfallErrorBody, ScryfallList } from './types'

const API = 'https://api.scryfall.com'
const MIN_GAP_MS = 100 // Scryfall asks for 50–100 ms between requests
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'scryfall-cache:'
const MAX_RETRIES = 3

export class ScryfallError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ScryfallError'
    this.status = status
    this.code = code
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// --- Throttled queue -------------------------------------------------------
// Every call to api.scryfall.com goes through `enqueue`, which runs requests
// one at a time with at least MIN_GAP_MS between them.

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    return task()
  })
  // Keep the queue alive even if this task fails.
  queue = run.catch(() => undefined)
  return run
}

// --- Cache (memory + localStorage, 24h) ------------------------------------

interface CacheEntry {
  at: number
  data: unknown
}

const memoryCache = new Map<string, CacheEntry>()

function readCache<T>(key: string): T | undefined {
  const now = Date.now()
  let entry = memoryCache.get(key)
  if (!entry) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key)
      if (raw) entry = JSON.parse(raw) as CacheEntry
    } catch {
      // localStorage unavailable or corrupt: treat as a miss
    }
  }
  if (!entry || now - entry.at > CACHE_TTL_MS) return undefined
  memoryCache.set(key, entry)
  return entry.data as T
}

function writeCache(key: string, data: unknown) {
  const entry: CacheEntry = { at: Date.now(), data }
  memoryCache.set(key, entry)
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Quota exceeded or storage blocked: the memory cache still works
  }
}

// --- Requests --------------------------------------------------------------

async function fetchJson<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetch(API + path, { headers: { Accept: 'application/json' } })
    } catch {
      throw new ScryfallError(0, 'network', 'Could not reach Scryfall. Check your internet connection and try again.')
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      // Too many requests: back off (1s, 2s, 4s) and retry.
      await sleep(1000 * 2 ** attempt)
      continue
    }

    const body = (await response.json().catch(() => null)) as T | ScryfallErrorBody | null
    if (!response.ok || !body) {
      const err = body as ScryfallErrorBody | null
      throw new ScryfallError(
        response.status,
        err?.code ?? 'unknown',
        err?.details ?? `Scryfall returned HTTP ${response.status}.`,
      )
    }
    return body as T
  }
}

/** GET a Scryfall API path through the throttled queue. Set `cache` for deterministic endpoints. */
export function scryfallGet<T>(path: string, { cache = false } = {}): Promise<T> {
  if (cache) {
    const hit = readCache<T>(path)
    if (hit !== undefined) return Promise.resolve(hit)
  }
  return enqueue(() => fetchJson<T>(path)).then((data) => {
    if (cache) writeCache(path, data)
    return data
  })
}

/** A random card matching a search query. Never cached (it's random). */
export function getRandomCard(query: string): Promise<ScryfallCard> {
  return scryfallGet<ScryfallCard>(`/cards/random?q=${encodeURIComponent(query)}`)
}

/** How many cards match a query (0 when nothing matches). Cached for 24h. */
export async function countCards(query: string): Promise<number> {
  try {
    const list = await scryfallGet<ScryfallList<ScryfallCard>>(
      `/cards/search?q=${encodeURIComponent(query)}`,
      { cache: true },
    )
    return list.total_cards ?? list.data.length
  } catch (e) {
    if (e instanceof ScryfallError && e.status === 404) return 0
    throw e
  }
}
