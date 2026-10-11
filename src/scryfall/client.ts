import type { ScryfallCard, ScryfallErrorBody, ScryfallList } from './types'

const API = 'https://api.scryfall.com'
const MIN_GAP_MS = 100 // Scryfall asks for 50–100 ms between requests
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'scryfall-cache:'

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
// strictly one at a time, with MIN_GAP_MS after each one finishes. (Letting
// requests overlap got us rate-limited, see "Scryfall gotchas" in CLAUDE.md.)
// Callers can still fire requests "in parallel" with Promise.all; they queue up.

let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task)
  // Keep the queue alive even if this task fails, and leave a gap before the next.
  queue = run.catch(() => undefined).then(() => sleep(MIN_GAP_MS))
  return run
}

// After a 429, every request fails straight away (without calling Scryfall)
// until Scryfall's Retry-After time has passed.
let blockedUntil = 0
const DEFAULT_BLOCK_MS = 60_000

function rateLimitedError() {
  const seconds = Math.ceil((blockedUntil - Date.now()) / 1000)
  return new ScryfallError(429, 'rate_limited', `Scryfall asked us to slow down. Try again in about ${seconds} seconds.`)
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

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (Date.now() < blockedUntil) throw rateLimitedError()
  let response: Response
  try {
    response = await enqueue(() => {
      // Re-check: a 429 may have arrived while this request was waiting.
      if (Date.now() < blockedUntil) throw rateLimitedError()
      return fetch(API + path, { ...init, headers: { Accept: 'application/json', ...init.headers } })
    })
  } catch (e) {
    if (e instanceof ScryfallError) throw e
    throw new ScryfallError(0, 'network', 'Could not reach Scryfall. Check your internet connection and try again.')
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After'))
    blockedUntil = Date.now() + (retryAfter > 0 ? retryAfter * 1000 : DEFAULT_BLOCK_MS)
    throw rateLimitedError()
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

/** Cached requests already on their way, so asking twice at once only fetches once. */
const inFlight = new Map<string, Promise<unknown>>()

/** GET a Scryfall API path through the throttled queue. Set `cache` for deterministic endpoints. */
export function scryfallGet<T>(path: string, { cache = false } = {}): Promise<T> {
  if (!cache) return fetchJson<T>(path)
  const hit = readCache<T>(path)
  if (hit !== undefined) return Promise.resolve(hit)
  const pending = inFlight.get(path)
  if (pending) return pending as Promise<T>
  const request = fetchJson<T>(path)
    .then((data) => {
      writeCache(path, data)
      return data
    })
    .finally(() => inFlight.delete(path))
  inFlight.set(path, request)
  return request
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

/** Specific printings by Scryfall id, in one request per 75 cards. Missing ids are left out. */
export async function getCardsByIds(ids: string[]): Promise<ScryfallCard[]> {
  const unique = [...new Set(ids)]
  const cards: ScryfallCard[] = []
  for (let i = 0; i < unique.length; i += 75) {
    const list = await fetchJson<ScryfallList<ScryfallCard>>('/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: unique.slice(i, i + 75).map((id) => ({ id })) }),
    })
    cards.push(...list.data)
  }
  return cards
}
