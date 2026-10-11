// Every deck challenge, as data. Adding a challenge = adding one object here.
// All `otag:` / `art:` / `is:` keywords and regexes below were verified against
// the live API (see "Scryfall gotchas" in CLAUDE.md).

import { shuffle } from '../generator/colours'
import { pickTribe, tribeClause } from '../generator/modifiers'
import { countCards, getRandomCard } from '../scryfall/client'
import { joinClauses } from '../scryfall/query'
import { cardCreatureTypes, deckCardQuery, drawCards, drawOneOf, hasTag, NoCardsError, pickFeasible } from './draw'
import { LAND_TARGET, NONLAND_TARGET } from './feasibility'
import type { ChallengeContext, ChallengeDefinition, ParamValues } from './types'

const num = (p: ParamValues, key: string) => Number(p[key])
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const pickOne = <T,>(items: T[], random: () => number) => items[Math.floor(random() * items.length)]
const randomInt = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1))
const quoted = (words: string[]) => words.map((w) => `“${w}”`).join(', ')

/** Nonland cards in the commander's colours that obey the current restrictions, plus a fragment. */
const nonlandPool = (ctx: ChallengeContext, fragment: string) => joinClauses(ctx.deckBase, '-t:land', ctx.restrictions, fragment)

/** Function tags used by "Off-theme spice". */
export const OFF_THEMES: { tag: string; label: string }[] = [
  { tag: 'lifegain', label: 'lifegain' },
  { tag: 'mill', label: 'mill' },
  { tag: 'discard', label: 'discard' },
  { tag: 'sacrifice-outlet', label: 'sacrifice' },
  { tag: 'burn', label: 'burn' },
  { tag: 'reanimate', label: 'reanimation' },
  { tag: 'counters-matter', label: '+1/+1 counters' },
  { tag: 'self-mill', label: 'self-mill' },
  { tag: 'landfall', label: 'landfall' },
  { tag: 'copy', label: 'copy' },
  { tag: 'theft', label: 'theft' },
  { tag: 'protection', label: 'protection' },
  { tag: 'hand-disruption', label: 'hand disruption' },
  { tag: 'blink', label: 'blink' },
]

/** Art tags with a decent pool somewhere. Each roll keeps only tags big enough for your colours. */
export const ART_TAGS = [
  'dragon', 'skull', 'moon', 'water', 'fire', 'cat', 'dog', 'sword', 'tree', 'book', 'bird', 'ship', 'night',
  'snow', 'lightning', 'mushroom', 'skeleton', 'food', 'smiling', 'hat', 'candle', 'sun', 'blood', 'tentacle',
  'eye', 'wings', 'horse', 'frog', 'rat', 'squirrel', 'pirate', 'ocean', 'mask', 'glasses', 'castle', 'rain',
]

/** Words for "Forbidden words". The query matches the start of a word, so "draw" also bans "draws" but not "withdraw". */
export const FORBIDDEN_WORDS = [
  'target', 'draw', 'destroy', 'exile', 'counter', 'sacrifice', 'token', 'damage', 'graveyard', 'life', 'when', 'you may', ':',
]
export const forbiddenWordClause = (word: string) => (word === ':' ? '-o:":"' : `-o:/\\b${word}/`)

/** Letters for the lipogram, roughly hardest first. */
export const LIPOGRAM_LETTERS = ['e', 'a', 'r', 'i', 't', 'o', 'n', 's']

/** Card types for "Type quota", with the range of minimums to roll. */
export const TYPE_QUOTAS: { type: string; plural: string; min: number; max: number }[] = [
  { type: 'artifact', plural: 'artifacts', min: 6, max: 12 },
  { type: 'enchantment', plural: 'enchantments', min: 6, max: 12 },
  { type: 'instant', plural: 'instants', min: 6, max: 12 },
  { type: 'sorcery', plural: 'sorceries', min: 6, max: 12 },
  { type: 'equipment', plural: 'Equipment', min: 3, max: 6 },
  { type: 'aura', plural: 'Auras', min: 3, max: 6 },
  { type: 'vehicle', plural: 'Vehicles', min: 2, max: 4 },
  { type: 'saga', plural: 'Sagas', min: 2, max: 4 },
]

const THIS_YEAR = new Date().getFullYear()

export const CHALLENGES: ChallengeDefinition[] = [
  // --- Must-include cards ---------------------------------------------------
  {
    id: 'random-includes',
    name: 'Random must-includes',
    description: 'Your deck must contain X random cards in your commander’s colours.',
    category: 'must-include',
    difficulty: 1,
    type: 'auto',
    params: [{ kind: 'number', key: 'count', label: 'Cards', min: 1, max: 10, default: 3 }],
    generate: async (p, ctx) => ({ cards: await drawCards(ctx, '-t:land', num(p, 'count')) }),
    summary: (p, g) => `Include ${plural(g?.cards?.length ?? num(p, 'count'), 'random card')}.`,
  },
  {
    id: 'albatross',
    name: 'The albatross',
    description: 'One must-include is deliberately bad: a card almost nobody plays (very high EDHREC rank).',
    category: 'must-include',
    difficulty: 2,
    type: 'auto',
    generate: async (_p, ctx) => ({
      cards: [await drawOneOf(ctx, ['-t:land edhrec>20000', '-t:land edhrec>12000', '-t:land edhrec>6000'])],
    }),
    summary: () => 'Include this deliberately bad card, and make it work.',
  },
  {
    id: 'bomb',
    name: 'Rare bomb',
    description: 'A random popular rare or mythic must be included.',
    category: 'must-include',
    difficulty: 1,
    type: 'auto',
    generate: async (_p, ctx) => ({
      cards: [await drawOneOf(ctx, ['-t:land r>=rare edhrec<=1500', '-t:land r>=rare edhrec<=5000', '-t:land r>=rare'])],
    }),
    summary: () => 'Include this rare/mythic bomb.',
  },
  {
    id: 'random-land',
    name: 'Random land',
    description: 'One specific random non-basic land must be in the deck.',
    category: 'must-include',
    difficulty: 1,
    type: 'auto',
    // Restrictions are about nonland cards, so lands ignore them.
    generate: async (_p, ctx) => ({ cards: await drawCards(ctx, 't:land -t:basic', 1, { withRestrictions: false }) }),
    summary: () => 'Include this land.',
  },
  {
    id: 'off-theme',
    name: 'Off-theme spice',
    description: 'Include one card from a strategy your commander doesn’t care about (e.g. lifegain in an aggro deck).',
    category: 'must-include',
    difficulty: 2,
    type: 'auto',
    generate: async (_p, ctx) => {
      for (const theme of shuffle(OFF_THEMES, ctx.random)) {
        // "Off-theme" = the commander itself isn't tagged with it.
        if (await hasTag(ctx.commander, theme.tag)) continue
        try {
          return { cards: await drawCards(ctx, `-t:land otag:${theme.tag}`, 1), choice: theme.label }
        } catch (e) {
          if (!(e instanceof NoCardsError)) throw e
        }
      }
      throw new NoCardsError('Couldn’t find an off-theme card in your commander’s colours.')
    },
    summary: (_p, g) => (g?.choice ? `Include this off-theme ${g.choice} card.` : 'Include one off-theme card.'),
  },
  {
    id: 'alt-win-con',
    name: 'Alt win-con',
    description: 'Include a random “you win the game” card, and try to win with it.',
    category: 'must-include',
    difficulty: 2,
    type: 'auto',
    generate: async (_p, ctx) => ({ cards: [await drawOneOf(ctx, ['-t:land o:"you win the game"', 'o:"you win the game"'])] }),
    summary: () => 'Include this alternate win condition, and try to win with it.',
  },

  // --- Card type restrictions ----------------------------------------------
  {
    id: 'creatureless',
    name: 'Creature-less',
    description: 'No creatures in the deck except your commander.',
    category: 'card-types',
    difficulty: 3,
    type: 'auto',
    conflictsWith: ['creatures-lands-only', 'tribal', 'square-deal', 'wall-street', 'french-vanilla'],
    pool: 'nonland',
    buildQueryFragment: () => '-t:creature',
    summary: () => 'No creatures except your commander.',
  },
  {
    id: 'creatures-lands-only',
    name: 'Creatures + lands only',
    description: 'Every nonland card is a creature: no instants, sorceries, or non-creature artifacts and enchantments.',
    category: 'card-types',
    difficulty: 2,
    type: 'auto',
    conflictsWith: ['type-minimum', 'type-quota'],
    pool: 'nonland',
    buildQueryFragment: () => 't:creature',
    summary: () => 'Only creatures and lands.',
  },
  {
    id: 'no-instants-sorceries',
    name: 'No instants or sorceries',
    description: 'Your deck can’t contain instants or sorceries.',
    category: 'card-types',
    difficulty: 2,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '-t:instant -t:sorcery',
    summary: () => 'No instants or sorceries.',
  },
  {
    id: 'permanents-only',
    name: 'Permanents only',
    description: 'Every card in the deck is a permanent.',
    category: 'card-types',
    difficulty: 2,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => 'is:permanent',
    summary: () => 'Permanents only.',
  },
  {
    id: 'tribal',
    name: 'Tribal',
    description: 'At least N creatures must share one creature type: a random one, or one of your commander’s.',
    category: 'card-types',
    difficulty: 2,
    type: 'auto',
    params: [
      { kind: 'number', key: 'count', label: 'Creatures', min: 5, max: 30, default: 15 },
      {
        kind: 'select',
        key: 'source',
        label: 'Type',
        default: 'random',
        options: [
          { value: 'random', label: 'Random' },
          { value: 'commander', label: 'Commander’s' },
        ],
      },
    ],
    unavailable: (p, ctx) => {
      const typeLine = ctx.commander.type_line ?? ctx.commander.card_faces?.[0]?.type_line ?? ''
      if (p.source === 'commander' && !/Creature/.test(typeLine.split(' // ')[0])) {
        return 'Your commander has no creature types.'
      }
      return undefined
    },
    pool: 'quota',
    generate: async (p, ctx) => {
      if (p.source === 'commander') {
        const tribe = pickTribe(await cardCreatureTypes(ctx.commander), ctx.random)
        if (!tribe) throw new NoCardsError('Your commander has no creature types.')
        return { choice: tribe }
      }
      // Like the commander's random tribe: borrow the type of a random creature in your colours.
      for (let attempt = 0; attempt < 3; attempt++) {
        const seed = await getRandomCard(deckCardQuery(ctx, 't:creature'))
        const tribe = pickTribe(await cardCreatureTypes(seed), ctx.random)
        if (tribe) return { choice: tribe }
      }
      throw new NoCardsError('Couldn’t pick a creature type.')
    },
    quotas: (p, g) => [
      { label: `${g?.choice ?? 'Same-type'} creatures`, fragment: `t:creature ${tribeClause(g?.choice ?? '')}`, needed: num(p, 'count') },
    ],
    summary: (p, g) => `At least ${num(p, 'count')} ${g?.choice ?? 'same-type'} creatures.`,
  },
  {
    id: 'type-minimum',
    name: 'Artifact or enchantment minimum',
    description: 'At least N artifacts, or at least N enchantments (picked at random).',
    category: 'card-types',
    difficulty: 2,
    type: 'auto',
    params: [
      { kind: 'number', key: 'count', label: 'Cards', min: 5, max: 20, default: 10 },
      {
        kind: 'select',
        key: 'kind',
        label: 'Type',
        default: 'random',
        options: [
          { value: 'random', label: 'Random' },
          { value: 'artifact', label: 'Artifacts' },
          { value: 'enchantment', label: 'Enchantments' },
        ],
      },
    ],
    pool: 'quota',
    generate: async (p, ctx) => ({
      choice: p.kind === 'random' ? pickOne(['artifact', 'enchantment'], ctx.random) : String(p.kind),
    }),
    quotas: (p, g) => [{ label: `${g?.choice ?? 'artifact'}s`, fragment: `t:${g?.choice ?? 'artifact'}`, needed: num(p, 'count') }],
    summary: (p, g) => `At least ${num(p, 'count')} ${g?.choice ?? 'artifact or enchantment'}s.`,
  },
  {
    id: 'type-quota',
    name: 'Type quota',
    description: 'Two random minimums, e.g. “at least 10 enchantments and 5 Equipment”.',
    category: 'card-types',
    difficulty: 2,
    type: 'auto',
    pool: 'quota',
    generate: async (_p, ctx) => ({
      // Encoded as "enchantment:10|equipment:5".
      choice: shuffle(TYPE_QUOTAS, ctx.random)
        .slice(0, 2)
        .map((t) => `${t.type}:${randomInt(t.min, t.max, ctx.random)}`)
        .join('|'),
    }),
    quotas: (_p, g) =>
      (g?.choice ?? '').split('|').filter(Boolean).map((part) => {
        const [type, n] = part.split(':')
        const info = TYPE_QUOTAS.find((t) => t.type === type)
        return { label: info?.plural ?? type, fragment: `t:${type}`, needed: Number(n) }
      }),
    summary: (_p, g) => {
      const parts = (g?.choice ?? '').split('|').filter(Boolean).map((part) => {
        const [type, n] = part.split(':')
        return `${n} ${TYPE_QUOTAS.find((t) => t.type === type)?.plural ?? type}`
      })
      return parts.length ? `At least ${parts.join(' and ')}.` : 'Two random card type minimums.'
    },
  },

  // --- Art & flavour ------------------------------------------------------------
  {
    id: 'art-theme',
    name: 'Art theme',
    description:
      'A random art theme (dragons, hats, skulls, moons…) for every nonland card, or for at least N% of them. Uses Scryfall’s art tags, which are good but not perfect.',
    category: 'art',
    difficulty: 3,
    type: 'auto',
    params: [{ kind: 'number', key: 'percent', label: '% of cards', min: 25, max: 100, step: 25, default: 100 }],
    pool: (p) => (num(p, 'percent') >= 100 ? 'nonland' : 'quota'),
    generate: async (p, ctx) => {
      const needed = Math.ceil((num(p, 'percent') / 100) * ctx.nonlandTarget)
      return { choice: await pickFeasible(ctx, ART_TAGS, (tag) => nonlandPool(ctx, `art:${tag}`), needed) }
    },
    buildQueryFragment: (_p, g) => `art:${g?.choice ?? ''}`,
    quotas: (p, g, format) => [
      {
        label: `${g?.choice} art`,
        fragment: `-t:land art:${g?.choice ?? ''}`,
        needed: Math.ceil((num(p, 'percent') / 100) * NONLAND_TARGET[format]),
      },
    ],
    summary: (p, g) =>
      num(p, 'percent') >= 100
        ? `Every nonland card’s art shows: ${g?.choice ?? 'a random theme'}.`
        : `At least ${num(p, 'percent')}% of your nonland cards show ${g?.choice ?? 'a random theme'} in the art.`,
  },
  {
    id: 'art-bingo',
    name: 'Art bingo',
    description: 'Three random art themes: at least N cards showing each one.',
    category: 'art',
    difficulty: 2,
    type: 'auto',
    params: [{ kind: 'number', key: 'count', label: 'Per theme', min: 3, max: 8, default: 5 }],
    pool: 'quota',
    generate: async (p, ctx) => {
      // Count a dozen random tags at once; keep three with at least twice the minimum, so there's some choice.
      const candidates = shuffle(ART_TAGS, ctx.random).slice(0, 12)
      const counts = await Promise.all(candidates.map((tag) => countCards(nonlandPool(ctx, `art:${tag}`))))
      const tags = candidates.filter((_tag, i) => counts[i] >= num(p, 'count') * 2).slice(0, 3)
      if (tags.length < 3) throw new NoCardsError('Not enough art themes have cards in your colours (with your other rules).')
      return { choice: tags.join('|') }
    },
    quotas: (p, g) =>
      (g?.choice ?? '').split('|').filter(Boolean).map((tag) => ({ label: `${tag} art`, fragment: `-t:land art:${tag}`, needed: num(p, 'count') })),
    summary: (p, g) => {
      const tags = (g?.choice ?? '').split('|').filter(Boolean)
      return tags.length ? `At least ${num(p, 'count')} cards showing each of: ${tags.join(', ')}.` : 'Three random art themes.'
    },
  },
  {
    id: 'same-artist',
    name: 'Same artist',
    description: 'At least N cards illustrated by one random artist.',
    category: 'art',
    difficulty: 2,
    type: 'auto',
    params: [{ kind: 'number', key: 'count', label: 'Cards', min: 4, max: 12, default: 6 }],
    pool: 'quota',
    generate: async (p, ctx) => {
      // Borrow the artists of a few random cards in your colours, then keep one with enough cards.
      const seeds = await Promise.all([1, 2, 3, 4, 5].map(() => getRandomCard(deckCardQuery(ctx, '-t:land'))))
      const artists = [...new Set(seeds.map((s) => (s.artist ?? s.card_faces?.[0]?.artist ?? '').replace(/"/g, '')).filter(Boolean))]
      if (artists.length === 0) throw new NoCardsError('Couldn’t pick an artist.')
      return { choice: await pickFeasible(ctx, artists, (a) => nonlandPool(ctx, `a:"${a}"`), num(p, 'count') * 2) }
    },
    quotas: (p, g) => [{ label: `cards by ${g?.choice}`, fragment: `-t:land a:"${g?.choice ?? ''}"`, needed: num(p, 'count') }],
    summary: (p, g) => `At least ${num(p, 'count')} cards illustrated by ${g?.choice ?? 'one artist'}.`,
  },
  {
    id: 'flavour-text',
    name: 'Flavour text required',
    description: 'Every nonland card has flavour text.',
    category: 'art',
    difficulty: 2,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => 'has:flavor',
    summary: () => 'Every nonland card has flavour text.',
  },
  {
    id: 'quote-book',
    name: 'Quote book',
    description: 'Every nonland card’s flavour text is a quote (attributed with “—”).',
    category: 'art',
    difficulty: 3,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => 'ft:"—"',
    summary: () => 'Every nonland card’s flavour text is a quote.',
  },
  {
    id: 'alphabet-soup',
    name: 'Alphabet soup',
    description: 'Every nonland card’s name starts with the same letter as your commander’s.',
    category: 'art',
    difficulty: 3,
    type: 'auto',
    pool: 'nonland',
    generate: async (_p, ctx) => ({ choice: (ctx.commander.name.match(/[a-z]/i)?.[0] ?? 'a').toLowerCase() }),
    buildQueryFragment: (_p, g) => `name:/^${g?.choice ?? 'a'}/`,
    summary: (_p, g) => `Every nonland card’s name starts with “${(g?.choice ?? '?').toUpperCase()}”.`,
  },

  // --- Mana & curve ----------------------------------------------------------
  {
    id: 'low-curve',
    name: 'Low curve',
    description: 'No nonland card with mana value over N.',
    category: 'mana',
    difficulty: 2,
    type: 'auto',
    params: [{ kind: 'number', key: 'max', label: 'Max MV', min: 1, max: 5, default: 3 }],
    unavailable: (p, ctx) =>
      ctx.commander.cmc > num(p, 'max')
        ? `Your commander costs ${ctx.commander.cmc}, which goes against a max-${num(p, 'max')} curve.`
        : undefined,
    pool: 'nonland',
    buildQueryFragment: (p) => `mv<=${num(p, 'max')}`,
    summary: (p) => `No nonland card over mana value ${num(p, 'max')}.`,
  },
  {
    id: 'odd-even',
    name: 'Odd or even',
    description: 'Every nonland card has an odd (or even) mana value.',
    category: 'mana',
    difficulty: 2,
    type: 'auto',
    conflictsWith: ['prime-time'],
    params: [
      {
        kind: 'select',
        key: 'parity',
        label: 'Parity',
        default: 'random',
        options: [
          { value: 'random', label: 'Random' },
          { value: 'odd', label: 'Odd' },
          { value: 'even', label: 'Even' },
        ],
      },
    ],
    pool: 'nonland',
    generate: async (p, ctx) => ({ choice: p.parity === 'random' ? pickOne(['odd', 'even'], ctx.random) : String(p.parity) }),
    buildQueryFragment: (_p, g) => `mv:${g?.choice ?? 'odd'}`,
    summary: (_p, g) => `Every nonland card has an ${g?.choice ?? 'odd/even'} mana value.`,
  },
  {
    id: 'hybrid-heaven',
    name: 'Hybrid heaven',
    description: 'At least N hybrid or Phyrexian mana cards.',
    category: 'mana',
    difficulty: 2,
    type: 'auto',
    params: [{ kind: 'number', key: 'count', label: 'Cards', min: 3, max: 12, default: 6 }],
    pool: 'quota',
    quotas: (p) => [{ label: 'hybrid/Phyrexian cards', fragment: '(is:hybrid or is:phyrexian)', needed: num(p, 'count') }],
    summary: (p) => `At least ${num(p, 'count')} hybrid or Phyrexian mana cards.`,
  },
  {
    id: 'no-basics',
    name: 'No basic lands',
    description: 'Every land in the deck is a non-basic land.',
    category: 'mana',
    difficulty: 2,
    type: 'auto',
    conflictsWith: ['basics-only'],
    pool: 'quota',
    quotas: (_p, _g, format) => [{ label: 'non-basic lands', fragment: 't:land -t:basic', needed: LAND_TARGET[format], lands: true }],
    summary: () => 'No basic lands.',
  },
  {
    id: 'basics-only',
    name: 'Basics only',
    description: 'Your only lands are basic lands.',
    category: 'mana',
    difficulty: 1,
    type: 'auto',
    conflictsWith: ['random-land'],
    summary: () => 'Basic lands only.',
  },

  // --- Arena budget ----------------------------------------------------------
  {
    id: 'commons-uncommons',
    name: 'Commons & uncommons only',
    description: 'Pauper-ish Brawl: no rares or mythics in the deck (the commander is exempt).',
    category: 'budget',
    difficulty: 2,
    type: 'auto',
    conflictsWith: ['wildcard-budget'],
    pool: 'nonland',
    buildQueryFragment: () => 'r<=uncommon',
    summary: () => 'Commons and uncommons only.',
  },
  {
    id: 'wildcard-budget',
    name: 'Wildcard budget',
    description: 'At most N rares and M mythics in the deck, so it’s cheap to craft.',
    category: 'budget',
    difficulty: 1,
    type: 'auto',
    params: [
      { kind: 'number', key: 'rares', label: 'Rares', min: 0, max: 15, default: 6 },
      { kind: 'number', key: 'mythics', label: 'Mythics', min: 0, max: 5, default: 2 },
    ],
    pool: 'quota',
    quotas: (p, _g, format) => [
      {
        label: 'commons & uncommons',
        fragment: '-t:land r<=uncommon',
        needed: Math.max(0, NONLAND_TARGET[format] - num(p, 'rares') - num(p, 'mythics')),
      },
    ],
    summary: (p) => `At most ${plural(num(p, 'rares'), 'rare')} and ${plural(num(p, 'mythics'), 'mythic')}.`,
  },
  {
    id: 'single-set',
    name: 'Single set',
    description: 'Every nonland card comes from one random Arena set.',
    category: 'budget',
    difficulty: 3,
    type: 'auto',
    pool: 'nonland',
    generate: async (_p, ctx) => {
      // Borrow the set of a random card in your colours, until one has enough cards.
      const seeds = await Promise.all([1, 2, 3, 4, 5, 6].map(() => getRandomCard(deckCardQuery(ctx, '-t:land'))))
      const seen = new Map(seeds.map((s) => [s.set, s.set_name]))
      const code = await pickFeasible(ctx, [...seen.keys()], (set) => nonlandPool(ctx, `e:${set}`), ctx.nonlandTarget)
      return { choice: `${code}|${seen.get(code)}` }
    },
    buildQueryFragment: (_p, g) => `e:${g?.choice?.split('|')[0] ?? ''}`,
    summary: (_p, g) => {
      const [code, name] = g?.choice?.split('|') ?? []
      return code ? `Every nonland card is from ${name} (${code.toUpperCase()}).` : 'Every nonland card is from one set.'
    },
  },
  {
    id: 'recent-sets',
    name: 'Recent sets only',
    description: 'Every nonland card has a printing from the last N years.',
    category: 'budget',
    difficulty: 1,
    type: 'auto',
    params: [{ kind: 'number', key: 'years', label: 'Years', min: 1, max: 5, default: 2 }],
    pool: 'nonland',
    buildQueryFragment: (p) => `year>=${THIS_YEAR - num(p, 'years') + 1}`,
    summary: (p) => `Only cards printed since ${THIS_YEAR - num(p, 'years') + 1}.`,
  },

  // --- Banned effects ---------------------------------------------------------
  {
    id: 'no-counterspells',
    name: 'No counterspells',
    description: 'No cards that counter spells.',
    category: 'banned',
    difficulty: 1,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '-otag:counterspell',
    summary: () => 'No counterspells.',
  },
  {
    id: 'no-tutors',
    name: 'No tutors',
    description: 'No cards that search your library (Scryfall’s tutor tag also covers land searches).',
    category: 'banned',
    difficulty: 1,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '-otag:tutor',
    summary: () => 'No tutors.',
  },
  {
    id: 'no-board-wipes',
    name: 'No board wipes',
    description: 'No mass removal.',
    category: 'banned',
    difficulty: 1,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '-otag:board-wipe',
    summary: () => 'No board wipes.',
  },
  {
    id: 'no-ramp',
    name: 'No ramp',
    description: 'Lands-only mana: no ramp spells, mana rocks or mana creatures.',
    category: 'banned',
    difficulty: 2,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '-otag:ramp',
    summary: () => 'No ramp: your lands are your mana.',
  },
  {
    id: 'no-game-changers',
    name: 'No Game Changers',
    description: 'No cards on the official Game Changers list.',
    category: 'banned',
    difficulty: 1,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '-is:gamechanger',
    summary: () => 'No Game Changers.',
  },

  // --- Funky ----------------------------------------------------------------------
  {
    id: 'forbidden-words',
    name: 'Forbidden words',
    description: 'Random words (like “target” or “draw”) can’t appear in the rules text of any nonland card.',
    category: 'funky',
    difficulty: 3,
    type: 'auto',
    params: [{ kind: 'number', key: 'count', label: 'Words', min: 1, max: 3, default: 2 }],
    pool: 'nonland',
    generate: async (p, ctx) => ({ choice: shuffle(FORBIDDEN_WORDS, ctx.random).slice(0, num(p, 'count')).join('|') }),
    buildQueryFragment: (_p, g) => joinClauses(...(g?.choice ?? '').split('|').filter(Boolean).map(forbiddenWordClause)),
    summary: (_p, g) => {
      const words = (g?.choice ?? '').split('|').filter(Boolean)
      return words.length ? `Forbidden words: ${quoted(words)}. No nonland card’s rules text may contain them.` : 'Forbidden words.'
    },
  },
  {
    id: 'lipogram',
    name: 'Lipogram',
    description: 'No nonland card’s name may contain a certain letter.',
    category: 'funky',
    difficulty: 3,
    type: 'auto',
    params: [
      {
        kind: 'select',
        key: 'letter',
        label: 'Letter',
        default: 'random',
        options: [
          { value: 'random', label: 'Random' },
          { value: 'e', label: 'Always E' },
        ],
      },
    ],
    pool: 'nonland',
    generate: async (p, ctx) => ({
      choice:
        p.letter === 'e'
          ? 'e'
          : await pickFeasible(ctx, LIPOGRAM_LETTERS, (l) => nonlandPool(ctx, `-name:${l}`), ctx.nonlandTarget * 2),
    }),
    buildQueryFragment: (_p, g) => `-name:${g?.choice ?? 'e'}`,
    summary: (_p, g) => `No nonland card’s name contains the letter “${(g?.choice ?? 'e').toUpperCase()}”.`,
  },
  {
    id: 'one-word-names',
    name: 'One-word names',
    description: 'Every nonland card has a one-word name (Opt, Ponder, Ugin…).',
    category: 'funky',
    difficulty: 3,
    type: 'auto',
    conflictsWith: ['short-names'],
    pool: 'nonland',
    buildQueryFragment: () => 'name:/^[^ ]+$/',
    summary: () => 'Every nonland card has a one-word name.',
  },
  {
    id: 'short-names',
    name: 'Short names',
    description: 'Every nonland card’s name is N characters or fewer.',
    category: 'funky',
    difficulty: 2,
    type: 'auto',
    params: [{ kind: 'number', key: 'max', label: 'Max letters', min: 8, max: 12, default: 10 }],
    pool: 'nonland',
    buildQueryFragment: (p) => `name:/^.{1,${num(p, 'max')}}$/`,
    summary: (p) => `Every nonland card’s name is ${num(p, 'max')} characters or fewer.`,
  },
  {
    id: 'legends-only',
    name: 'Legends only',
    description: 'Every nonland card is legendary.',
    category: 'funky',
    difficulty: 3,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => 't:legendary',
    summary: () => 'Every nonland card is legendary.',
  },
  {
    id: 'gold-rush',
    name: 'Gold rush',
    description: 'Every nonland card is multicoloured.',
    category: 'funky',
    difficulty: 3,
    type: 'auto',
    unavailable: (_p, ctx) =>
      ctx.commander.color_identity.length < 2 ? 'Your commander has fewer than two colours.' : undefined,
    pool: 'nonland',
    buildQueryFragment: () => 'c:m',
    summary: () => 'Every nonland card is multicoloured.',
  },
  {
    id: 'square-deal',
    name: 'Square deal',
    description: 'Every creature’s power equals its toughness.',
    category: 'funky',
    difficulty: 2,
    type: 'auto',
    conflictsWith: ['wall-street'],
    pool: 'nonland',
    buildQueryFragment: () => '(-t:creature or pow=tou)',
    summary: () => 'Every creature has power equal to its toughness.',
  },
  {
    id: 'wall-street',
    name: 'Wall street',
    description: 'Every creature has more toughness than power.',
    category: 'funky',
    difficulty: 2,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '(-t:creature or tou>pow)',
    summary: () => 'Every creature has more toughness than power.',
  },
  {
    id: 'prime-time',
    name: 'Prime time',
    description: 'Every nonland card has a prime mana value: 2, 3, 5 or 7.',
    category: 'funky',
    difficulty: 2,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '(mv=2 or mv=3 or mv=5 or mv=7)',
    summary: () => 'Every nonland card has mana value 2, 3, 5 or 7.',
  },
  {
    id: 'french-vanilla',
    name: 'French vanilla club',
    description: 'At least N creatures whose only rules text is keywords.',
    category: 'funky',
    difficulty: 2,
    type: 'auto',
    params: [{ kind: 'number', key: 'count', label: 'Creatures', min: 5, max: 20, default: 10 }],
    pool: 'quota',
    quotas: (p) => [{ label: 'French vanilla creatures', fragment: 'is:frenchvanilla', needed: num(p, 'count') }],
    summary: (p) => `At least ${num(p, 'count')} French vanilla creatures (keywords only).`,
  },
  {
    id: 'arena-exclusive',
    name: 'Arena exclusive',
    description: 'At least N digital-only cards that “perpetually” change things or “seek” cards.',
    category: 'funky',
    difficulty: 2,
    type: 'auto',
    params: [{ kind: 'number', key: 'count', label: 'Cards', min: 3, max: 15, default: 8 }],
    pool: 'quota',
    quotas: (p) => [{ label: 'perpetually/seek cards', fragment: '(o:perpetually or o:seek)', needed: num(p, 'count') }],
    summary: (p) => `At least ${num(p, 'count')} digital-only “perpetually” or “seek” cards.`,
  },
  {
    id: 'no-humans',
    name: 'No Humans',
    description: 'No Human creatures in the deck.',
    category: 'funky',
    difficulty: 1,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => '-t:human',
    summary: () => 'No Humans allowed.',
  },

  // --- Miscellaneous --------------------------------------------------------------
  {
    id: 'no-mulligans',
    name: 'No mulligans',
    description: 'Keep every opening hand.',
    category: 'misc',
    difficulty: 1,
    type: 'honour',
    summary: () => 'No mulligans: keep every opening hand.',
  },
]

export const CHALLENGES_BY_ID: Record<string, ChallengeDefinition> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]))
