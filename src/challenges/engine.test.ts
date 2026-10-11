import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScryfallCard } from '../scryfall/types'
import { DEFAULT_SETTINGS, type Settings } from '../state/settings'
import { defaultChallengeSettings } from './conflicts'
import { runChallenges } from './engine'

// Fake Scryfall: every random draw returns a new card; every count returns 500.
const { randomQueries } = vi.hoisted(() => ({ randomQueries: [] as string[] }))
vi.mock('../scryfall/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../scryfall/client')>()),
  getRandomCard: vi.fn(async (q: string) => {
    randomQueries.push(q)
    const n = randomQueries.length
    return { name: `Card ${n}`, oracle_id: `o${n}`, type_line: 'Creature — Elf', color_identity: ['G'] } as ScryfallCard
  }),
  countCards: vi.fn(async () => 500),
}))

const commander = { name: 'Cmdr', oracle_id: 'cmdr', cmc: 3, type_line: 'Legendary Creature — Elf', color_identity: ['G'] } as ScryfallCard

function settingsWith(enabled: Record<string, Record<string, number | string>>): Settings {
  const challenges = defaultChallengeSettings()
  for (const [id, params] of Object.entries(enabled)) challenges[id] = { enabled: true, params: { ...challenges[id].params, ...params } }
  return { ...DEFAULT_SETTINGS, challenges }
}

beforeEach(() => {
  randomQueries.length = 0
})

describe('runChallenges', () => {
  it('generated cards obey the nonland restrictions and skip the commander and each other', async () => {
    const run = await runChallenges(settingsWith({ 'random-includes': { count: 2 }, creatureless: {}, 'low-curve': { max: 3 } }), commander)

    expect(randomQueries[0]).toBe('game:arena f:brawl id<=g -t:land -t:creature mv<=3 -oracleid:cmdr')
    expect(randomQueries[1]).toContain('-oracleid:o1')
    expect(run.outcomes.find((o) => o.id === 'random-includes')?.generated?.cards).toHaveLength(2)
  })

  it('checks each pool and the combined pool', async () => {
    const run = await runChallenges(settingsWith({ creatureless: {}, 'no-ramp': {} }), commander)
    expect(run.outcomes.map((o) => o.pools?.[0].query)).toEqual([
      'game:arena f:brawl id<=g -t:land -t:creature',
      'game:arena f:brawl id<=g -t:land -otag:ramp',
    ])
    expect(run.combined?.query).toBe('game:arena f:brawl id<=g -t:land -t:creature -otag:ramp')
    expect(run.combined?.level).toBe('ok')
  })

  it('skips challenges that do not fit the commander', async () => {
    const run = await runChallenges(settingsWith({ 'low-curve': { max: 2 } }), commander)
    expect(run.outcomes[0].skipped).toMatch(/costs 3/)
    expect(run.outcomes[0].pools).toBeUndefined()
  })

  it('rerolls only the requested challenge', async () => {
    const settings = settingsWith({ 'random-includes': { count: 1 }, bomb: {} })
    const first = await runChallenges(settings, commander)
    const second = await runChallenges(settings, commander, { previous: first, reroll: 'bomb' })

    const cards = (run: typeof first, id: string) => run.outcomes.find((o) => o.id === id)?.generated?.cards?.[0].name
    expect(cards(second, 'random-includes')).toBe(cards(first, 'random-includes'))
    expect(cards(second, 'bomb')).not.toBe(cards(first, 'bomb'))
    // The kept card is reserved so the new draw can't repeat it.
    expect(randomQueries.at(-1)).toContain(`-oracleid:${first.outcomes[0].generated?.cards?.[0].oracle_id}`)
  })
})
