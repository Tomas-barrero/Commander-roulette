import { identityName } from '../generator/colours'
import type { CardFace, ScryfallCard } from '../scryfall/types'
import { ColourPips, ManaCost, OracleText } from './ManaSymbols'

/** Normal cards have one "face"; split, adventure and double-faced cards have several. */
function faces(card: ScryfallCard): CardFace[] {
  if (card.card_faces?.length) {
    return card.card_faces.map((f, i) =>
      // Some layouts (e.g. adventures) keep P/T on the card, not the face.
      i === 0 ? { ...f, power: f.power ?? card.power, toughness: f.toughness ?? card.toughness } : f,
    )
  }
  return [card]
}

function Stats({ face }: { face: CardFace }) {
  const stat =
    face.power !== undefined
      ? `${face.power}/${face.toughness}`
      : face.loyalty !== undefined
        ? `Loyalty ${face.loyalty}`
        : face.defense !== undefined
          ? `Defense ${face.defense}`
          : undefined
  if (!stat) return null
  return (
    <div className="mt-3 text-right">
      <span className="rounded border border-stone-500 bg-stone-800 px-2 py-0.5 font-semibold">{stat}</span>
    </div>
  )
}

export function RulesText({ card }: { card: ScryfallCard }) {
  const artists = [...new Set(faces(card).map((f) => f.artist ?? card.artist).filter(Boolean))]

  return (
    <article className="w-full max-w-md space-y-4 rounded-xl border border-stone-700 bg-stone-900/80 p-5 text-stone-200 shadow-xl">
      {faces(card).map((face, i) => (
        <section key={i} className={i > 0 ? 'border-t border-stone-700 pt-4' : ''}>
          <header className="flex items-start justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold text-amber-50">{face.name}</h2>
            {face.mana_cost && <ManaCost cost={face.mana_cost} />}
          </header>
          {face.type_line && <p className="mt-1 text-sm text-stone-400">{face.type_line}</p>}
          {face.oracle_text && (
            <div className="mt-3 leading-relaxed">
              <OracleText text={face.oracle_text} />
            </div>
          )}
          {face.flavor_text && <p className="mt-3 text-sm text-stone-400 italic">{face.flavor_text}</p>}
          <Stats face={face} />
        </section>
      ))}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-stone-700 pt-4 text-sm">
        <dt className="text-stone-400">Identity</dt>
        <dd className="flex items-center gap-2">
          <ColourPips colours={card.color_identity} size="h-4 w-4" />
          {identityName(card.color_identity)}
        </dd>
        <dt className="text-stone-400">Set</dt>
        <dd>
          {card.set_name} ({card.set.toUpperCase()}) · <span className="capitalize">{card.rarity}</span>
        </dd>
        <dt className="text-stone-400">Artist</dt>
        <dd>{artists.join(' & ') || 'Unknown'}</dd>
      </dl>

      <nav className="flex gap-4 text-sm">
        <a href={card.scryfall_uri} target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">
          View on Scryfall ↗
        </a>
        {card.related_uris?.edhrec && (
          <a href={card.related_uris.edhrec} target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">
            EDHREC ↗
          </a>
        )}
      </nav>
    </article>
  )
}
