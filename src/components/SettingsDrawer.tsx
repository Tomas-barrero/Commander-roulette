import { useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_MODIFIERS,
  MODIFIER_INFO,
  modifierConflict,
  MV_NO_LIMIT,
  planeswalkerOnlyBlocker,
  type CommanderModifiers,
  type Difficulty,
  type ModifierId,
} from '../generator/modifiers'
import { loadCreatureTypes } from '../scryfall/catalog'
import type { Format } from '../scryfall/types'
import type { Settings } from '../state/settings'

const THIS_YEAR = new Date().getFullYear()

function Skulls({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span title={`Difficulty ${difficulty} of 3`} className="text-xs whitespace-nowrap">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= difficulty ? '' : 'opacity-20 grayscale'}>
          💀
        </span>
      ))}
    </span>
  )
}

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-amber-400' : 'bg-stone-600'
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-5.5' : 'left-0.5'}`} />
    </button>
  )
}

/** A row of mutually exclusive buttons. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; disabledReason?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-600 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={!!o.disabledReason}
          title={o.disabledReason}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
            value === o.value ? 'bg-amber-400 font-semibold text-stone-900' : 'hover:bg-stone-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Range({ label, value, min, max, step = 1, display, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-10 text-stone-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-amber-400"
      />
      <span className="w-14 text-right tabular-nums">{display ?? value}</span>
    </label>
  )
}

const inputClass = 'rounded border border-stone-600 bg-stone-800 px-2 py-1 text-sm'

interface Props {
  open: boolean
  onClose: () => void
  settings: Settings
  onChange: (settings: Settings) => void
}

export function SettingsDrawer({ open, onClose, settings, onChange }: Props) {
  const m = settings.modifiers
  const [creatureTypes, setCreatureTypes] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Only needed for the "choose a creature type" list.
  useEffect(() => {
    if (open && m.tribe.enabled && m.tribe.mode === 'chosen' && creatureTypes.length === 0) {
      loadCreatureTypes().then(setCreatureTypes).catch(() => undefined)
    }
  }, [open, m.tribe.enabled, m.tribe.mode, creatureTypes.length])

  function set<K extends ModifierId>(id: K, value: CommanderModifiers[K]) {
    onChange({ ...settings, modifiers: { ...m, [id]: value } })
  }
  function patch<K extends ModifierId>(id: K, value: Partial<CommanderModifiers[K]>) {
    set(id, { ...(m[id] as object), ...value } as CommanderModifiers[K])
  }

  /** The parameter controls shown under each enabled modifier. */
  const params: Partial<Record<ModifierId, ReactNode>> = {
    rarity: (
      <Segmented
        value={m.rarity.value}
        onChange={(value) => patch('rarity', { value })}
        options={[
          { value: 'uncommon', label: 'Uncommon' },
          { value: 'common-uncommon', label: 'Common/uncommon' },
          { value: 'common', label: 'Common' },
        ]}
      />
    ),
    hipster: (
      <Range
        label="Rank >"
        value={m.hipster.minRank}
        min={1000}
        max={30000}
        step={1000}
        display={m.hipster.minRank.toLocaleString()}
        onChange={(minRank) => patch('hipster', { minRank })}
      />
    ),
    manaValue: (
      <div className="space-y-1">
        <Range label="Min" value={m.manaValue.min} min={0} max={MV_NO_LIMIT} onChange={(min) => patch('manaValue', { min })} />
        <Range
          label="Max"
          value={m.manaValue.max}
          min={0}
          max={MV_NO_LIMIT}
          display={m.manaValue.max >= MV_NO_LIMIT ? `${MV_NO_LIMIT}+` : undefined}
          onChange={(max) => patch('manaValue', { max })}
        />
      </div>
    ),
    tribe: (
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={m.tribe.mode}
          onChange={(mode) => patch('tribe', { mode })}
          options={[
            { value: 'random', label: 'Random' },
            { value: 'chosen', label: 'Choose' },
          ]}
        />
        {m.tribe.mode === 'chosen' && (
          <>
            <input
              list="creature-types"
              value={m.tribe.chosen}
              onChange={(e) => patch('tribe', { chosen: e.target.value })}
              placeholder="e.g. Dragon"
              className={inputClass}
            />
            <datalist id="creature-types">
              {creatureTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </>
        )}
      </div>
    ),
    era: (
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={m.era.mode}
          onChange={(mode) => patch('era', { mode })}
          options={[
            { value: 'random-set', label: 'Random set' },
            { value: 'years', label: 'Years' },
          ]}
        />
        {m.era.mode === 'years' && (
          <span className="flex items-center gap-1 text-sm">
            <input
              type="number"
              min={1993}
              max={THIS_YEAR}
              value={m.era.fromYear}
              onChange={(e) => patch('era', { fromYear: Number(e.target.value) })}
              className={`${inputClass} w-20`}
            />
            to
            <input
              type="number"
              min={1993}
              max={THIS_YEAR}
              value={m.era.toYear}
              onChange={(e) => patch('era', { toYear: Number(e.target.value) })}
              className={`${inputClass} w-20`}
            />
          </span>
        )}
      </div>
    ),
    rerollBudget: (
      <Range
        label="Rerolls"
        value={m.rerollBudget.rerolls}
        min={0}
        max={20}
        onChange={(rerolls) => patch('rerollBudget', { rerolls })}
      />
    ),
  }

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Settings"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-stone-700 bg-stone-900 shadow-2xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-stone-700 px-5 py-4">
          <h2 className="font-serif text-xl font-semibold text-amber-100">Settings</h2>
          <button type="button" onClick={onClose} className="rounded px-2 text-2xl text-stone-400 hover:text-white" aria-label="Close settings">
            ×
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">General</h3>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Format</span>
              <select
                value={settings.format}
                onChange={(e) => onChange({ ...settings, format: e.target.value as Format })}
                className={inputClass}
              >
                <option value="brawl">Brawl (100 cards)</option>
                <option value="standardbrawl">Standard Brawl (60 cards)</option>
              </select>
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">Commander modifiers</h3>
            {MODIFIER_INFO.map((info) => {
              const conflict = modifierConflict(info.id, m)
              const value = m[info.id]
              const toggleable = typeof value === 'object'
              const enabled = toggleable ? (value as { enabled: boolean }).enabled : value !== 'allow' && value !== 'include'
              return (
                <div
                  key={info.id}
                  title={conflict}
                  className={`space-y-2 rounded-lg border p-3 transition ${
                    enabled && !conflict ? 'border-amber-400/50 bg-amber-400/5' : 'border-stone-700'
                  } ${conflict ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{info.name}</span>
                        <Skulls difficulty={info.difficulty} />
                      </div>
                      <p className="text-xs text-stone-400">{conflict ?? info.description}</p>
                    </div>
                    {toggleable && (
                      <Toggle
                        label={info.name}
                        checked={enabled}
                        disabled={!!conflict}
                        onChange={(on) => patch(info.id, { enabled: on } as Partial<CommanderModifiers[typeof info.id]>)}
                      />
                    )}
                  </div>

                  {info.id === 'planeswalkers' && (
                    <Segmented
                      value={m.planeswalkers}
                      onChange={(v) => set('planeswalkers', v)}
                      options={[
                        { value: 'allow', label: 'Allow' },
                        { value: 'disallow', label: 'Disallow' },
                        { value: 'only', label: 'Only', disabledReason: planeswalkerOnlyBlocker(m) },
                      ]}
                    />
                  )}
                  {info.id === 'alchemy' && (
                    <Segmented
                      value={m.alchemy}
                      onChange={(v) => set('alchemy', v)}
                      options={[
                        { value: 'include', label: 'Include' },
                        { value: 'exclude', label: 'Exclude' },
                        { value: 'only', label: 'Only' },
                      ]}
                    />
                  )}
                  {toggleable && enabled && !conflict && params[info.id]}
                </div>
              )
            })}
          </section>
        </div>

        <footer className="border-t border-stone-700 px-5 py-3 text-right">
          <button
            type="button"
            onClick={() => onChange({ ...settings, modifiers: DEFAULT_MODIFIERS })}
            className="text-sm text-stone-400 hover:text-white"
          >
            Reset modifiers
          </button>
        </footer>
      </aside>
    </div>
  )
}

