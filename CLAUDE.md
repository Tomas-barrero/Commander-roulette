# Random Commander Generator (MTG Arena)

A web app that generates a random **Brawl commander that's playable on MTG Arena** to build around. I can tweak settings for the commander, then optionally stack on **deckbuilding challenges** (must-include cards, type restrictions, art themes, etc.) to spice things up.

Personal/fan project. Prefer simple and working over clever and abstract.

## Stack

- **Vite + React + TypeScript**, Tailwind
- **No backend.** Everything runs in the browser against the Scryfall API. (Verified 2026-10: Scryfall sends `access-control-allow-origin: *` on api.scryfall.com and svgs.scryfall.io, so no proxy is needed.)
- **localStorage** for settings, favourites and generation history (wrap in try/catch)
- Deployable as a static site (GitHub Pages / Netlify / Vercel)

## Data source: Scryfall

API base: `https://api.scryfall.com`. Docs: https://scryfall.com/docs/api and search syntax at https://scryfall.com/docs/syntax.

### Scryfall rules we MUST follow
- **Rate limit:** 50–100 ms delay between requests to `api.scryfall.com`. Build one shared request queue/throttle and send all calls through it. Image hosts (`*.scryfall.io`) aren't rate limited.
- **Cache** responses (in memory + localStorage with a timestamp) for at least 24 hours. Feasibility counts and symbol data especially.
- **Images:** never crop, cover, blur, recolour, stretch or watermark card images. When showing the **`art_crop`**, show the **artist name** (and a link to the full card) in the same view.
- Don't use Scryfall's logo or imply endorsement. Don't paywall anything.
- Footer disclaimer: unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy, not approved or endorsed by Wizards. Card data and images via Scryfall.

### Key search syntax (all queries are built from these)
- **Arena only:** `game:arena`
- **Brawl legal (Arena's 100-card Brawl):** `f:brawl`. Standard Brawl is `f:standardbrawl` (make the format a setting, default `brawl`).
- **Can be a Brawl commander:** `is:brawler` (includes planeswalkers that can be commanders)
- **Colour identity:** `id=wu` (exactly), `id<=wub` (within), `id=c` (colourless), `id:3` style counts may also work. Verify each against the live API.
- **Card type:** `t:creature`, `t:legendary`, `-t:creature`
- **Rarity:** `r:common`, `r<=uncommon`
- **Mana value:** `mv<=3`, `mv:odd`
- **Art tags:** `art:dragon`, `art:moon` (Tagger data. Coverage is good but not perfect.)
- **Function tags:** `otag:removal`, `otag:ramp`, `otag:counterspell`, `otag:tutor`, `otag:board-wipe` (verify tag names)
- **Popularity:** `edhrec>5000` (higher number = more obscure)
- **Digital-only:** `is:alchemy`, `is:rebalanced` (Arena "A-" rebalanced versions)
- **Random single card:** `GET /cards/random?q=<query>`
- **Random N cards / counts:** `GET /cards/search?q=<query>` gives `total_cards`. Pick random indexes, fetch the right page(s), and dedupe by `oracle_id`.

**Always URL-encode queries, and always include `game:arena f:<format>`** on every query for the deck (not just the commander), so every suggested card is actually available on Arena.

## Feature 1: Colour selection

Modes (radio):
- **Fully random**: any identity, including colourless
- **Mono / Two / Three / Four / Five colour**: random identity with exactly N colours
- **Manual**: toggle W/U/B/R/G (+ colourless) and choose **"exactly these"** or **"within these"**

Show the chosen identity as mana pips, and the guild/shard/wedge name where one applies (Azorius, Jund, Mardu...).

## Feature 2: Commander display

- The **full card image** (`image_uris.large` or `png`), large and centred
- **Double-faced cards**: images live in `card_faces[]`, so add a flip button
- Next to it: a **rules text panel** with name, mana cost and type line, plus oracle text with **real mana symbols** (render from the `/symbology` endpoint's SVGs, cached), P/T or loyalty, artist credit, and set + rarity
- Links: Scryfall page, EDHREC page (`related_uris`)
- A blurred `art_crop` as a page background is a nice touch, **only** with the artist credited on screen (blurring as a background decoration is a grey area, so show the unaltered art crop/full card too, or skip the blur if unsure)
- Buttons: **Reroll**, **Lock & reroll challenges only**, **Favourite**, **Copy/share**
- History of the last ~20 generated commanders

## Feature 3: Challenges & modifiers

Each challenge is a **toggle in a Settings drawer**, grouped by category, with its own parameters (number inputs, dropdowns) and a difficulty rating (1–3 skulls). Also:
- **Chaos mode**: randomly enable N challenges (N chosen by a slider), weighted by a difficulty dial
- **Feasibility check**: for every challenge that narrows the card pool, query Scryfall for `total_cards` within the commander's identity + Arena + format, and show the pool size. **Warn or block** if it's too small to build a deck (e.g. an art theme with only 30 legal cards in that identity). Offer "reroll this challenge".
- Each challenge has a `type`: **auto** (the app generates or validates something with Scryfall) or **honour** (a rule I follow myself, just displayed)

### Commander modifiers
1. **Rarity of commander**: only uncommon (or common/uncommon) commanders
2. **Hipster mode**: commander must be obscure (`edhrec>N`, slider)
3. **Mana value range** for the commander (e.g. MV 1–3 or 6+)
4. **Creature type**: commander must be a random tribe (Elf, Dragon, Zombie...)
5. **Planeswalker commanders**: allow / disallow / only
6. **Era**: commander from a random set, or a release-year range (`year>=2020`)
7. **Alchemy**: include / exclude / only Alchemy & rebalanced cards
8. **Tiny commander**: power ≤ 2
9. **Reroll budget**: only N rerolls allowed per session

### Must-include cards (auto)
10. **Random must-includes**: deck must contain X random cards in the commander's identity (X = slider, 1–10)
11. **The albatross**: one must-include is deliberately bad (very high EDHREC rank or a known jank card)
12. **Random rare/mythic bomb** must be included
13. **Random land**: one specific random non-basic land must be in the deck
14. **Off-theme spice**: one random card from a function tag that doesn't match the commander (e.g. a lifegain card in an aggro deck)

### Card type restrictions
15. **Creature-less**: no creatures except the commander
16. **Creatures + lands only**: no instants, sorceries, artifacts or enchantments
17. **No instants or sorceries**
18. **Permanent-only deck** (`is:permanent`)
19. **Artifact or enchantment minimum**: at least N of a random type
20. **Tribal**: at least N creatures must share a creature type (random, or the commander's)
21. **Type quota**: random minimums, e.g. "at least 10 enchantments and 5 equipment"

### Art & flavour themes (auto pool check via `art:` tags)
22. **Art theme across all cards**: every nonland card must show a random theme. Keep a curated list of verified tags (dragon, skull, moon, water, fire, cat, sword, tree, ship, castle, book, bird, ...) and filter it at runtime to tags with a big enough pool. Option: all cards vs. at least N%.
23. **Same artist**: at least N cards by one random artist (`a:`)
24. **Flavour text required**: every nonland card has flavour text (`has:flavor`, verify syntax)
25. **Alphabet soup**: every nonland card's name starts with the same letter as the commander's
26. **Name chain**: each card's name must start with the last letter of the previous one (honour)

### Mana & curve
27. **Low curve**: no nonland card over MV N (default 3)
28. **Odd or even**: all nonland cards have odd (or even) mana value
29. **No basics** / **basics only** for lands
30. **Hybrid heaven**: at least N hybrid or Phyrexian mana cards (`is:hybrid`, `is:phyrexian`)

### Arena-specific budget
31. **Wildcard budget**: max N rares and M mythics in the 99 (so the deck is cheap to craft)
32. **Commons & uncommons only** in the 99 (Pauper-ish Brawl)
33. **Single set**: all nonland cards from one random Arena set
34. **Recent sets only**: cards from the last N years of Arena sets

### Banned effects (auto pool filters + honour)
35. **No counterspells** (`otag:counterspell`)
36. **No tutors**
37. **No board wipes**
38. **No ramp spells**: lands-only mana
39. **No Game Changers** (`is:gamechanger`)

### Alternate goals (honour)
40. **Alt win-con**: deck must include and try to win with an "you win the game" card (`o:"win the game"`)
41. **Commander can't attack**
42. **Commander tax challenge**: can't cast the commander before turn N
43. **Pacifist**: can't attack until turn N
44. **Mill-out**: you can only win by milling (or by poison, or commander damage, randomly chosen)

Keep the challenge definitions **data-driven**: one array of challenge objects in `src/challenges/definitions.ts` with id, name, description, category, difficulty, params, type (auto/honour), a `buildQueryFragment(params, ctx)` for auto filters, and a `generate(ctx)` for things like must-include cards. Adding a new challenge should mean adding one object.

**Conflict rules**: some challenges contradict each other (Creature-less vs. Tribal, Low curve vs. a 7-drop commander). Declare `conflictsWith` on each definition and disable conflicting toggles in the UI with a tooltip.

## Feature 4: Arena availability

- Every query includes `game:arena` + the chosen format legality.
- For **displaying** a card, prefer an Arena printing if one exists.
- Must-include cards and anything else that's generated must also pass `game:arena f:<format>`.
- **Export to Arena**: a "Copy for Arena" button that puts the commander + must-includes in Arena's import format:
  ```
  Commander
  1 <Commander Name>

  Deck
  1 <Must-include 1>
  1 <Must-include 2>
  ```
  Use the card's exact name. For split/DFCs, use the front face name and test that Arena accepts it.

## The results screen

- The commander (Feature 2)
- A **"Your challenge"** card listing every active rule, with icons and difficulty
- Must-include cards as a row of small card images (click to enlarge)
- Pool-size info for each constraint
- **Share link**: encode settings + commander + challenge results in the URL, so I can send a challenge to friends
- **Copy for Arena** button

## Project structure (target)

```
src/
  scryfall/     client (throttled queue, cache), types, query builder, symbology
  generator/    commander picking, colour identity logic, feasibility checks
  challenges/   definitions.ts, conflict resolution, chaos mode
  components/   CardDisplay, RulesText, ManaSymbols, ColourPicker, SettingsDrawer, ChallengeList
  state/        settings store (persisted), history, share-link encoding
```

## Conventions

- TypeScript strict. Type only the Scryfall fields we use.
- The query builder is pure and **unit-tested with Vitest**. Test the colour identity strings, challenge fragments and combined queries.
- Handle Scryfall errors well: 404 (no card matches, which means the settings are too narrow, so explain which setting to loosen), 429 (back off), and network failure.
- Loading states: a nice shuffle/card-flip animation while generating.
- Commit after each working milestone.

## Commands

- `npm run dev`
- `npm test`
- `npm run build`

## Roadmap

1. **Core:** Scryfall client with throttle + cache, colour selection, generate a random Arena Brawl commander, full card display + rules text with mana symbols, reroll
2. **Settings drawer** + commander modifiers (1–9), settings persisted
3. **Challenge engine:** data-driven definitions, must-include generation, feasibility checks, conflict handling
4. **Rest of the challenge list** + chaos mode
5. **Export + share:** Copy for Arena, share links, history & favourites
6. **Polish:** animations, mobile layout, dark "card table" theme, deploy

## Notes for Claude

- I'm learning as we go. Briefly explain key decisions.
- **Verify every Scryfall keyword and tag against the live API** before relying on it (run a test query and check `total_cards`). Tag names especially can differ from what you'd guess. Record any surprises in a "Scryfall gotchas" section at the bottom of this file.
- The Arena card pool changes with each set release and rotation, so never hardcode card lists. Always query.

## Scryfall gotchas

Verified against the live API on 2026-10-11 (counts are for `game:arena f:brawl is:brawler`, so they'll drift with new sets):

- **`id:wu` means "within", not "exactly".** `id:w` returned 313 commanders, the same as `id<=w`; `id=w` returned 260. Always use `id=` or `id<=` explicitly.
- **`id<=xy` includes colourless commanders** (53 of them). Add `-id=c` to exclude them. `id=c` and `id:c` both mean "colourless only".
- **Colour-count syntax works:** `id=3` → 204 three-colour commanders; `id>=4` → 56.
- **Some identities have zero (or nearly zero) Arena commanders.** `id=ubrg` → 404, `id=wubr` → 3, `id=wubrg` → 44. So "random N-colour identity" tries the identities in random order until one has a match.
- **`is:brawler` isn't just creatures and planeswalkers.** About 22 are other cards that can be commanders (e.g. Esika's Chariot, Dawnsire). 2411 total for `f:brawl`, 910 for `f:standardbrawl`.
- **`is:rebalanced` currently matches nothing** (404 even on its own), and there are no `A-` named cards. Use `is:alchemy` alone for Alchemy (122 commanders).
- **`edhrec>N` drops cards with no EDHREC rank.** Many Alchemy cards are unranked: only 24 of the 122 Alchemy commanders match `edhrec>0`. `-has:edhrec` isn't supported (it's ignored with a warning).
- Rarity: `r:common` → 49 commanders, `r:uncommon` → 614, `r<=uncommon` → 663.
- `/cards/random?q=…` honours `game:arena`, so the printing it returns is an Arena printing. A 404 there means nothing matches.
- Search results include a `warnings` array when part of a query is ignored. Check it when testing new syntax, because the count looks normal otherwise.
- **User-Agent:** Scryfall rejects Node's default `fetch` User-Agent (HTTP 400). Browsers are fine (they send their own and pages can't override it), but scripts or tests that call the live API from Node must set a custom `User-Agent`.
- **Random tribe / random set use a "seed" draw.** The generator first fetches a random commander matching everything else, then uses one of its creature types (avoiding Human when there's another option, since Humans are ~41% of creature commanders) or its set. The final draw is then guaranteed at least one match. Multi-word creature types are matched against `/catalog/creature-types` (e.g. `t:"Time Lord"`, which has no Arena commanders at the moment).
- `e:<set>` and `year>=` match *printings*: a commander reprinted on Arena in 2024 counts as 2024.
- `pow<=2` excludes non-creature commanders automatically (they have no power), so Tiny commander conflicts with Planeswalkers-only.
