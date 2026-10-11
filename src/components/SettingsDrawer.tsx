import { useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_MODIFIERS,
  MODIFIER_INFO,
  modifierConflict,
  MV_NO_LIMIT,
  planeswalkerOnlyBlocker,
  type CommanderModifiers,
  type ModifierId,
} from '../generator/modifiers'
import { defaultChallengeSettings } from '../challenges/conflicts'
import { loadCreatureTypes } from '../scryfall/catalog'
import type { Format } from '../scryfall/types'
import type { Settings } from '../state/settings'
import { ChallengeSettingsSection } from './ChallengeSettings'
import { inputClass, OptionCard, Range, Segmented, Toggle } from './controls'

const THIS_YEAR = new Date().getFullYear()

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
    // Stop the page scrolling behind the drawer.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
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
            <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">🎲 Chaos mode</h3>
            <div
              className={`space-y-3 rounded-lg border p-3 transition ${
                settings.chaos.enabled ? 'border-fuchsia-400/60 bg-fuchsia-400/5' : 'border-stone-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-medium">Random challenges</span>
                  <p className="text-xs text-stone-400">
                    Every roll adds {settings.chaos.count} random challenge{settings.chaos.count === 1 ? '' : 's'} from every
                    category (commander modifiers included), on top of any you switch on below. Random picks whose pool is too
                    small get swapped automatically.
                  </p>
                </div>
                <Toggle
                  label="Chaos mode"
                  checked={settings.chaos.enabled}
                  onChange={(enabled) => onChange({ ...settings, chaos: { ...settings.chaos, enabled } })}
                />
              </div>
              {settings.chaos.enabled && (
                <>
                  <Range
                    label="How many"
                    value={settings.chaos.count}
                    min={1}
                    max={10}
                    onChange={(count) => onChange({ ...settings, chaos: { ...settings.chaos, count } })}
                  />
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-20 text-stone-400">Difficulty</span>
                    <Segmented
                      value={settings.chaos.difficulty}
                      onChange={(difficulty) => onChange({ ...settings, chaos: { ...settings.chaos, difficulty } })}
                      options={[
                        { value: 'easy', label: '💀 Easy' },
                        { value: 'mixed', label: 'Mixed' },
                        { value: 'hard', label: '💀💀💀 Hard' },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">Commander modifiers</h3>
            {MODIFIER_INFO.map((info) => {
              const conflict = modifierConflict(info.id, m)
              const value = m[info.id]
              const toggleable = typeof value === 'object'
              const enabled = toggleable ? (value as { enabled: boolean }).enabled : value !== 'allow' && value !== 'include'
              return (
                <OptionCard
                  key={info.id}
                  name={info.name}
                  difficulty={info.difficulty}
                  description={info.description}
                  enabled={enabled}
                  disabledReason={conflict}
                  onToggle={
                    toggleable
                      ? (on) => patch(info.id, { enabled: on } as Partial<CommanderModifiers[typeof info.id]>)
                      : undefined
                  }
                >
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
                </OptionCard>
              )
            })}
          </section>

          <ChallengeSettingsSection
            value={settings.challenges}
            onChange={(challenges) => onChange({ ...settings, challenges })}
          />
        </div>

        <footer className="border-t border-stone-700 px-5 py-3 text-right">
          <button
            type="button"
            onClick={() =>
              onChange({ ...settings, modifiers: DEFAULT_MODIFIERS, challenges: defaultChallengeSettings() })
            }
            className="text-sm text-stone-400 hover:text-white"
          >
            Reset modifiers & challenges
          </button>
        </footer>
      </aside>
    </div>
  )
}

