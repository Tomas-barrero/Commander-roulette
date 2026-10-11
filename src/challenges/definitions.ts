// Every deck challenge, as data. Adding a challenge = adding one object here.
// All `otag:` / `is:` keywords below were verified against the live API
// (see "Scryfall gotchas" in CLAUDE.md).

import { shuffle } from '../generator/colours'
import { pickTribe, tribeClause } from '../generator/modifiers'
import { getRandomCard } from '../scryfall/client'
import { cardCreatureTypes, deckCardQuery, drawCards, drawOneOf, hasTag, NoCardsError } from './draw'
import type { ChallengeDefinition, ParamValues } from './types'

const num = (p: ParamValues, key: string) => Number(p[key])
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Function tags used by "Off-theme spice". Each one checked with a live query. */
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
    summary: (p, g) => `Include ${g?.cards ? plural(g.cards.length, 'random card') : plural(num(p, 'count'), 'random card')}.`,
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

  // --- Card type restrictions ----------------------------------------------
  {
    id: 'creatureless',
    name: 'Creature-less',
    description: 'No creatures in the deck except your commander.',
    category: 'card-types',
    difficulty: 3,
    type: 'auto',
    conflictsWith: ['creatures-lands-only', 'tribal'],
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
    quota: (p) => num(p, 'count'),
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
    buildQueryFragment: (_p, g) => (g?.choice ? `t:creature ${tribeClause(g.choice)}` : 't:creature'),
    summary: (p, g) => `At least ${num(p, 'count')} ${g?.choice ?? 'same-type'} creatures.`,
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

  // --- Arena budget ----------------------------------------------------------
  {
    id: 'commons-uncommons',
    name: 'Commons & uncommons only',
    description: 'Pauper-ish Brawl: no rares or mythics in the deck (the commander is exempt).',
    category: 'budget',
    difficulty: 2,
    type: 'auto',
    pool: 'nonland',
    buildQueryFragment: () => 'r<=uncommon',
    summary: () => 'Commons and uncommons only.',
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

  // --- Alternate goals (honour) --------------------------------------------------
  {
    id: 'commander-cant-attack',
    name: 'Commander can’t attack',
    description: 'Your commander never attacks. It has to win some other way.',
    category: 'goals',
    difficulty: 2,
    type: 'honour',
    summary: () => 'Your commander can’t attack.',
  },
  {
    id: 'commander-tax',
    name: 'Late commander',
    description: 'You can’t cast your commander before turn N.',
    category: 'goals',
    difficulty: 2,
    type: 'honour',
    params: [{ kind: 'number', key: 'turn', label: 'Turn', min: 3, max: 10, default: 5 }],
    summary: (p) => `Don’t cast your commander before turn ${num(p, 'turn')}.`,
  },
  {
    id: 'pacifist',
    name: 'Pacifist',
    description: 'You can’t attack until turn N.',
    category: 'goals',
    difficulty: 2,
    type: 'honour',
    params: [{ kind: 'number', key: 'turn', label: 'Turn', min: 3, max: 10, default: 6 }],
    summary: (p) => `No attacking before turn ${num(p, 'turn')}.`,
  },
]

export const CHALLENGES_BY_ID: Record<string, ChallengeDefinition> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]))
