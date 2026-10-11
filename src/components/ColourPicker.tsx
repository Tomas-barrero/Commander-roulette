import { COLOUR_NAMES, identityName, type ColourMode, type ColourSettings } from '../generator/colours'
import { WUBRG } from '../scryfall/query'
import type { Colour } from '../scryfall/types'
import { ColourPips } from './ManaSymbols'

const MODES: { value: ColourMode; label: string }[] = [
  { value: 'random', label: 'Fully random' },
  { value: '1', label: 'Mono' },
  { value: '2', label: 'Two' },
  { value: '3', label: 'Three' },
  { value: '4', label: 'Four' },
  { value: '5', label: 'Five' },
  { value: 'manual', label: 'Manual' },
]

interface Props {
  value: ColourSettings
  onChange: (value: ColourSettings) => void
}

export function ColourPicker({ value, onChange }: Props) {
  const { manual } = value
  const setManual = (patch: Partial<ColourSettings['manual']>) =>
    onChange({ ...value, manual: { ...manual, ...patch } })

  const toggleColour = (c: Colour) => {
    const colours = manual.colours.includes(c) ? manual.colours.filter((x) => x !== c) : [...manual.colours, c]
    // In "exactly" mode colourless can't be combined with colours.
    setManual({ colours, colourless: manual.match === 'exactly' ? false : manual.colourless })
  }

  const toggleColourless = () => {
    const colourless = !manual.colourless
    setManual({ colourless, colours: manual.match === 'exactly' && colourless ? [] : manual.colours })
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold tracking-wide text-amber-200/80 uppercase">Colour identity</legend>

      <div className="flex flex-wrap gap-2" role="radiogroup">
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${
              value.mode === m.value
                ? 'border-amber-300 bg-amber-300/20 text-amber-100'
                : 'border-stone-600 text-stone-300 hover:border-stone-400'
            }`}
          >
            <input
              type="radio"
              name="colour-mode"
              className="sr-only"
              checked={value.mode === m.value}
              onChange={() => onChange({ ...value, mode: m.value })}
            />
            {m.label}
          </label>
        ))}
      </div>

      {value.mode === 'manual' && (
        <div className="space-y-3 rounded-lg border border-stone-700 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {WUBRG.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleColour(c)}
                aria-pressed={manual.colours.includes(c)}
                title={COLOUR_NAMES[c]}
                className={`rounded-full p-1 transition ${
                  manual.colours.includes(c) ? 'bg-amber-300/30 ring-2 ring-amber-300' : 'opacity-40 hover:opacity-80'
                }`}
              >
                <ColourPips colours={[c]} size="h-8 w-8" />
              </button>
            ))}
            <button
              type="button"
              onClick={toggleColourless}
              aria-pressed={manual.colourless}
              title="Colourless"
              className={`rounded-full p-1 transition ${
                manual.colourless ? 'bg-amber-300/30 ring-2 ring-amber-300' : 'opacity-40 hover:opacity-80'
              }`}
            >
              <ColourPips colours={[]} size="h-8 w-8" />
            </button>
          </div>

          <div className="flex gap-4 text-sm">
            {(['exactly', 'within'] as const).map((match) => (
              <label key={match} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="colour-match"
                  checked={manual.match === match}
                  onChange={() =>
                    setManual({
                      match,
                      // Leaving "within" with colours + colourless selected would be contradictory.
                      colourless: match === 'exactly' && manual.colours.length ? false : manual.colourless,
                    })
                  }
                  className="accent-amber-300"
                />
                {match === 'exactly' ? 'Exactly these' : 'Within these'}
              </label>
            ))}
          </div>

          <p className="text-xs text-stone-400">
            {manual.match === 'exactly'
              ? 'The commander has exactly this identity. Colourless can’t be combined with colours.'
              : 'The commander’s identity is any subset of these. Toggle colourless to allow colourless commanders too.'}
          </p>

          {(manual.colours.length > 0 || manual.colourless) && manual.match === 'exactly' && (
            <p className="text-sm text-stone-300">
              <ColourPips colours={manual.colourless ? [] : manual.colours} size="h-4 w-4" />{' '}
              {identityName(manual.colourless ? [] : manual.colours)}
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}
