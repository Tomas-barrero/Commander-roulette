# Commander Roulette

Roll a random **MTG Arena Brawl** commander, then stack on deckbuilding challenges: must-include cards, art themes, forbidden words, chaos mode and more. Copy the result straight into Arena, or send the challenge to a friend as a link.

Runs entirely in the browser against the [Scryfall API](https://scryfall.com/docs/api). There's no backend.

## Run it

```
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (Scryfall is mocked)
npm run build    # static site in dist/
```

## Deploy

The build is a plain static site with relative paths, so it works from any folder.

- **GitHub Pages:** push to a GitHub repo, then go to **Settings → Pages → Source: GitHub Actions**. `.github/workflows/deploy.yml` tests, builds and publishes on every push to `master`/`main`. The site appears at `https://<user>.github.io/<repo>/`.
- **Netlify / Vercel:** import the repo with build command `npm run build` and output directory `dist`. No other config needed.

---

Commander Roulette is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC. Card data and images via Scryfall; this project isn't affiliated with or endorsed by Scryfall.
