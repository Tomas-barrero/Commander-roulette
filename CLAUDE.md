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
- **Rate limit:** 50–100 ms delay between requests to `api.scryfall.com`. Build one shared request queue/throttle and send all calls through it. Requests run **one at a time** (the gap starts after the previous response); don't let them overlap. On a 429, stop *all* calls until `Retry-After` (default 60s); never auto-retry quickly. Image hosts (`*.scryfall.io`) aren't rate limited.
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
- **Chaos mode**: randomly enable N challenges (N chosen by a slider) from **every** category, commander modifiers included, on top of the ones switched on manually, weighted by a difficulty dial (easy / mixed / hard). Random picks that are skipped, fail or leave too small a pool are swapped (a couple of rounds), then dropped. Each chaos pick has a Swap button.
- **Feasibility check**: for every challenge that narrows the card pool, query Scryfall for `total_cards` within the commander's identity + Arena + format, and show the pool size. **Warn or block** if it's too small to build a deck (e.g. an art theme with only 30 legal cards in that identity). Offer "reroll this challenge".
- Each challenge has a `type`: **auto** (the app generates or validates something with Scryfall) or **honour** (a rule I follow myself, just displayed). **Decision (2026-10-11): no honour rules except No mulligans** (Miscellaneous category). Don't add gameplay honour rules.

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
26. ~~**Name chain**~~ (removed: honour rule)

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

### Alternate goals
40. **Alt win-con**: a generated must-include "you win the game" card (`o:"you win the game"`)
41–44. ~~Commander can't attack, Commander tax, Pacifist, Mill-out~~ (removed: honour rules)

### Funky (added 2026-10-11, pools verified live)
Forbidden words (1–3 random words banned from rules text), Lipogram (no letter X in names), One-word names, Short names, Legends only, Gold rush (all multicoloured), Square deal (power = toughness), Wall street (toughness > power), Prime time (MV 2/3/5/7), French vanilla club (≥ N), Arena exclusive (≥ N perpetually/seek cards), No Humans. Art bingo (3 random art tags × N cards) lives under Art & flavour.

### Miscellaneous
- **No mulligans** (honour, the only one)

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
- **Function tags (`otag:`) that exist:** `counterspell`, `tutor`, `board-wipe` (alias `sweeper`), `ramp`, `mana-rock`, `land-ramp`, `removal`, `burn`, `lifegain`, `mill`, `self-mill`, `discard`, `hand-disruption`, `sacrifice-outlet`, `reanimate`, `counters-matter`, `landfall`, `copy`, `theft`, `protection`, `blink` (alias `flicker`), `evasion`. **Don't exist (404):** `wrath`, `token-generator`, `card-draw`, `graveyard-recursion`, `lifelink`, `pump`.
- `otag:tutor` (635 cards on Arena Brawl) also covers land searches (e.g. Abzan Monument); `otag:ramp` (1291) includes mana creatures and rocks.
- `is:gamechanger` works (24 cards on Arena Brawl).
- `-oracleid:<id>` excludes a card in every printing; that's how generated cards skip the commander and each other. `oracleid:<id> otag:<tag>` checks whether a specific card has a tag (used by Off-theme spice).
- Must-include pools stay healthy even in narrow identities: mono-white has 802 nonland cards at `edhrec>20000` (albatross), 181 at `r>=rare edhrec<=1500` (bomb) and 245 non-basic lands; colourless has 210 non-basic lands.

## Challenge engine notes

- Deck challenges live in `src/challenges/definitions.ts` (46 now). Chaos mode is `src/challenges/chaos.ts`. Rules with several "at least N" checks return multiple `quotas`; land quotas set `lands: true` so the nonland restrictions don't apply to them.
- Commander modifiers (1–9) stay in `src/generator/modifiers.ts`, because they run *before* a commander exists and random tribe/set and the reroll budget need special handling.
- `pool: 'nonland'` challenges ("every nonland card must…") combine into `ctx.restrictions`, which every generated must-include card also has to match. `pool: 'quota'` challenges ("at least N…") are checked against the deck base + restrictions.
- Feasibility: a pool smaller than the nonland cards a deck needs (60 for Brawl, 35 for Standard Brawl, or N for a quota) is "too small"; under twice that is "tight".

### Rate limiting (learned the hard way, 2026-10-11)
- Letting requests overlap (starting one every 100ms without waiting for the previous response) plus a long testing session got a **429**: "try again after 60 seconds. DO NOT IGNORE THIS WARNING, FAILURE TO ACT WILL RESULT IN A NETWORK BLOCK." Strictly sequential + 100ms had run for hours without one. The client is sequential again and hard-stops on 429.
- scryfall.com/docs pages return 403 to automated fetchers, so the per-endpoint limits couldn't be checked from here. If someone can read https://scryfall.com/docs/api/rate-limits, record the numbers here.
- Keep live test runs small, and leave a pause between big batches.

### More gotchas (challenge brainstorm, 2026-10-11)
- **Regex limits:** `name:/^(.).* \1/` (backreferences) and `\S` silently match nothing (0 results, no warning). `o:/^.{0,80}$/` is rejected ("Too much repetition") and ignored with a warning. Simple regexes like `name:/^[^ ]+$/` (one-word names) and `name:/^.{1,10}$/` work.
- **Art tag pools vary hugely by colour,** so random art themes must be checked at runtime. Nonland pools in Dimir (UB) vs mono-green: `art:pirate` 111 vs 5, `art:tree` 278 vs 563, `art:mushroom` 27 vs 74, `art:rat` 113 vs 9. `art:staircase` doesn't exist (0).
- `-name:e` works as a lipogram filter (UB 762, G 491 nonland cards). `kw:flying` works. `pow=tou` and `tou>pow` work as comparisons. `is:vanilla` (UB 42) and `is:frenchvanilla` (UB 113) exist. `has:flavor` works (and so does `ft:/./`).

## Export, share & history notes

- **Share links** use the URL hash (`#share=<base64url JSON>`), so nothing reaches a server and any static host works. The payload (`src/state/share.ts`) holds the commander's Scryfall id, its restriction labels, each rolled challenge (id, params, choice, card ids), chaos picks and the sender's settings as a diff from the defaults. A heavy roll (12 cards + 5 rules) is about 1.3k characters.
- Opening a link or a history entry fetches every card in **one** `POST /cards/collection` request (up to 75 ids), then re-runs the challenges keeping everything rolled, which only re-checks pool counts (usually cached). The receiver's own settings are untouched unless they click "Use their settings".
- History (last 20) and favourites (up to 100) live in localStorage as share payloads plus a thumbnail URL, not full card objects, which would be too big.
- **Arena export:** multi-face cards use the front face name (`Delver of Secrets`, `Bonecrusher Giant`). ⚠️ Not yet tested in Arena itself, especially split cards (e.g. `Fire // Ice`). If Arena rejects one, try the `Fire /// Ice` form, then update `arenaName` and record the answer here.
