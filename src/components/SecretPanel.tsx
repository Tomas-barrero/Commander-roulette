import { useState } from 'react'
import type { SecretInfo, SecretSettings, SecretType } from '../generator/secret'
import { frontImage } from '../scryfall/images'
import type { ScryfallCard } from '../scryfall/types'
import { CardLightbox } from './CardLightbox'

const TYPE_OPTIONS: { value: SecretType; label: string }[] = [
  { value: 'any', label: 'Any type' },
  { value: 'creature', label: 'Creature' },
  { value: 'artifact', label: 'Artifact' },
  { value: 'enchantment', label: 'Enchantment' },
  { value: 'land', label: 'Land' },
]

/** Main-panel switch between a normal commander and a secret commander. */
export function SecretModeControl({ value, onChange }: { value: SecretSettings; onChange: (v: SecretSettings) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-stone-300">
      <div className="inline-flex overflow-hidden rounded-lg border border-stone-600" role="radiogroup" aria-label="Mode">
        {([false, true] as const).map((enabled) => (
          <button
            key={String(enabled)}
            type="button"
            role="radio"
            aria-checked={value.enabled === enabled}
            onClick={() => onChange({ ...value, enabled })}
            title={enabled ? 'Build around a non-legendary card instead, with commanders that can find it' : undefined}
            className={`px-2.5 py-0.5 transition ${
              value.enabled === enabled ? 'bg-amber-400 font-semibold text-stone-900' : 'hover:bg-stone-700'
            }`}
          >
            {enabled ? '🤫 Secret commander' : 'Commander'}
          </button>
        ))}
      </div>
      {value.enabled && (
        <label className="flex items-center gap-2">
          <span className="sr-only">Secret card type</span>
          <select
            value={value.type}
            onChange={(e) => onChange({ ...value, type: e.target.value as SecretType })}
            className="rounded border border-stone-600 bg-stone-800 px-2 py-0.5"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

function Thumb({ card, onClick, selected, label }: { card: ScryfallCard; onClick: () => void; selected?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={selected}
      className={`block w-full transition hover:-translate-y-1 ${selected ? 'ring-4 ring-amber-300' : ''}`}
    >
      <img src={frontImage(card)} alt={card.name} loading="lazy" className="h-auto w-full" />
    </button>
  )
}

interface Props {
  secret: SecretInfo
  secretName: string
  chosen: number
  onChoose: (index: number) => void
}

/** Secret commander mode: who leads the deck, and how to dig for the secret card. */
export function SecretPanel({ secret, secretName, chosen, onChoose }: Props) {
  const [enlarged, setEnlarged] = useState<ScryfallCard>()

  return (
    <section className="space-y-6 rounded-xl border border-fuchsia-400/40 bg-stone-900/80 p-5 shadow-xl">
      <div>
        <h2 className="font-serif text-xl font-semibold text-amber-100">🤫 Your secret commander</h2>
        <p className="mt-1 text-stone-300">
          <strong className="text-amber-100">{secretName}</strong> is the real star, but it can’t go in the command zone. Pick
          a commander to lead the deck, then dig for it.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">Pick your commander</h3>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {secret.commanders.map(({ card, reason }, i) => (
            <li key={card.id} className="space-y-1.5">
              <Thumb card={card} selected={i === chosen} onClick={() => onChoose(i)} label={`Lead with ${card.name}`} />
              <div className="flex flex-wrap items-center gap-1.5">
                {reason === 'finds' ? (
                  <span className="rounded bg-sky-900/70 px-1.5 py-0.5 text-[11px] text-sky-100" title="Its own ability can search your library for the secret card">
                    🔎 Can search for it
                  </span>
                ) : reason === 'theme' ? (
                  <span className="rounded bg-emerald-900/70 px-1.5 py-0.5 text-[11px] text-emerald-100">🤝 Loves {secret.theme}</span>
                ) : (
                  <span className="rounded bg-stone-700 px-1.5 py-0.5 text-[11px] text-stone-200" title="No commander searches for it or shares its strategy, so these are popular commanders in its colours">
                    🎨 Fits the colours
                  </span>
                )}
                <button type="button" onClick={() => setEnlarged(card)} className="text-[11px] text-stone-400 underline hover:text-white">
                  Enlarge
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-500">The commander you pick goes in the Commander slot when you copy for Arena.</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">Ways to find it</h3>
        {secret.finders.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-3">
              {secret.finders.map((card) => (
                <li key={card.id} className="w-28 sm:w-32">
                  <Thumb card={card} onClick={() => setEnlarged(card)} label={`${card.name} (click to enlarge)`} />
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-500">
              These can search your library for it, and all fit your commander’s colours. Check any extra conditions (like a
              mana value limit). Plenty of card draw and selection helps too.
            </p>
          </>
        ) : (
          <p className="text-sm text-stone-400">
            No tutor in these colours can fetch it directly, so lean on card draw, card selection and recursion to find it.
          </p>
        )}
      </div>

      {enlarged && <CardLightbox card={enlarged} onClose={() => setEnlarged(undefined)} />}
    </section>
  )
}
