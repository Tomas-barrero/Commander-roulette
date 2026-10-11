import { afterEach, describe, expect, it, vi } from 'vitest'
import { countCards, getRandomCard } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('request queue', () => {
  it('runs requests one at a time, at least 100ms apart, even when fired at once', async () => {
    const starts: number[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        starts.push(Date.now())
        return new Response(JSON.stringify({ object: 'card', name: 'X' }), { status: 200 })
      }),
    )
    await Promise.all([getRandomCard('a'), getRandomCard('b'), getRandomCard('c')])
    expect(starts).toHaveLength(3)
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(95)
  })

  it('fetches a cached query only once when asked twice at the same time', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ object: 'list', total_cards: 7, data: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([countCards('unique-query-xyz'), countCards('unique-query-xyz')])
    expect([a, b]).toEqual([7, 7])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats 404 as zero matching cards', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ object: 'error', status: 404, code: 'not_found', details: 'none' }), { status: 404 })))
    expect(await countCards('nothing-matches-this')).toBe(0)
  })

  // Keep this last: the block lasts for the rest of the file.
  it('after a 429, stops calling Scryfall until Retry-After has passed', async () => {
    const fetchMock = vi.fn(
      async () => new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(getRandomCard('first')).rejects.toMatchObject({ status: 429 })
    await expect(getRandomCard('second')).rejects.toThrow(/slow down/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
