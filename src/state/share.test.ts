import { describe, expect, it, vi } from 'vitest'
import type { ChallengeRun } from '../challenges/engine'
import type { ScryfallCard } from '../scryfall/types'
import { HISTORY_LIMIT, upsertEntry, type HistoryEntry } from './history'
import { DEFAULT_SETTINGS } from './settings'
import {
  buildSharePayload,
  decodeShare,
  diffFromDefaults,
  encodeShare,
  loadSharedChallenge,
  readShareFromHash,
  settingsFromShare,
  type SharePayload,
} from './share'

// Fake Scryfall: the collection endpoint returns whatever ids it's asked for; every count is 500.
vi.mock('../scryfall/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../scryfall/client')>()),
  getCardsByIds: vi.fn(async (ids: string[]) =>
    ids.map((id) => ({ id, name: `Card ${id}`, oracle_id: `o-${id}`, cmc: 2, type_line: 'Creature — Elf', color_identity: ['G'] })),
  ),
  countCards: vi.fn(async () => 500),
  getRandomCard: vi.fn(async () => {
    throw new Error('should not draw new cards when loading a share')
  }),
}))

const cardWith = (id: string) => ({ id, name: `Card ${id}`, oracle_id: `o-${id}` }) as ScryfallCard

describe('diffFromDefaults', () => {
  it('keeps only what changed', () => {
    expect(diffFromDefaults({ a: 1, b: { c: 2, d: 3 } }, { a: 1, b: { c: 2, d: 4 } })).toEqual({ b: { d: 4 } })
    expect(diffFromDefaults({ a: [1] }, { a: [1] })).toBeUndefined()
    expect(diffFromDefaults({ a: [1] }, { a: [1, 2] })).toEqual({ a: [1, 2] })
  })

  it('round-trips settings through mergeWithDefaults', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      format: 'standardbrawl' as const,
      chaos: { enabled: true, count: 4, difficulty: 'hard' as const },
    }
    const payload = { v: 1, c: 'x', r: [], ch: [], s: diffFromDefaults(DEFAULT_SETTINGS, settings) } as SharePayload
    expect(settingsFromShare(payload)).toEqual(settings)
  })
})

describe('encode / decode', () => {
  const payload: SharePayload = { v: 1, c: 'abc', r: ['Creature type: Elf', 'Lim-Dûl ✓'], ch: [{ i: 'tribal', p: { count: 15 }, c: 'Elf' }] }

  it('round-trips, including non-ASCII text', () => {
    const encoded = encodeShare(payload)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/) // URL-safe
    expect(decodeShare(encoded)).toEqual(payload)
    expect(readShareFromHash(`#share=${encoded}`)).toEqual(payload)
  })

  it('rejects damaged or foreign links', () => {
    expect(decodeShare('not-base64!!')).toBeUndefined()
    expect(decodeShare(encodeShare({ ...payload, v: 2 } as unknown as SharePayload))).toBeUndefined()
    expect(readShareFromHash('#something-else')).toBeUndefined()
  })
})

describe('buildSharePayload + loadSharedChallenge', () => {
  it('rebuilds the same commander, cards and choices without drawing anything new', async () => {
    const commander = { card: { ...cardWith('cmdr'), color_identity: ['G'] } as ScryfallCard, restrictions: ['Uncommon only'] }
    const run: ChallengeRun = {
      outcomes: [
        { id: 'random-includes', params: { count: 2 }, summary: '', generated: { cards: [cardWith('a'), cardWith('b')] } },
        { id: 'tribal', params: { count: 15, source: 'random' }, summary: '', generated: { choice: 'Elf' } },
        { id: 'no-ramp', params: {}, summary: '' },
      ],
    }
    const payload = buildSharePayload(DEFAULT_SETTINGS, commander, run, { modifiers: ['rarity'], challenges: ['tribal'] })
    expect(payload.s).toBeUndefined() // default settings add nothing to the link

    const loaded = await loadSharedChallenge(decodeShare(encodeShare(payload))!)
    expect(loaded.commander.card.id).toBe('cmdr')
    expect(loaded.commander.restrictions).toEqual(['Uncommon only'])
    expect(loaded.pick).toEqual({ modifiers: ['rarity'], challenges: ['tribal'] })
    const byId = Object.fromEntries(loaded.run!.outcomes.map((o) => [o.id, o]))
    expect(byId['random-includes'].generated?.cards?.map((c) => c.id)).toEqual(['a', 'b'])
    expect(byId.tribal.generated?.choice).toBe('Elf')
    expect(byId.tribal.summary).toBe('At least 15 Elf creatures.')
    expect(byId['no-ramp'].pools?.[0].count).toBe(500)
  })
})

describe('upsertEntry', () => {
  const entry = (key: string, at = 0) => ({ key, at, name: key, identity: [], share: { v: 1, c: key, r: [], ch: [] } }) as HistoryEntry

  it('puts the newest first and replaces the same key', () => {
    const list = upsertEntry(upsertEntry([], entry('a'), HISTORY_LIMIT), entry('b'), HISTORY_LIMIT)
    expect(upsertEntry(list, entry('a', 5), HISTORY_LIMIT).map((e) => [e.key, e.at])).toEqual([
      ['a', 5],
      ['b', 0],
    ])
  })

  it('caps the list length', () => {
    let list: HistoryEntry[] = []
    for (let i = 0; i < 30; i++) list = upsertEntry(list, entry(String(i)), HISTORY_LIMIT)
    expect(list).toHaveLength(HISTORY_LIMIT)
    expect(list[0].key).toBe('29')
  })
})
