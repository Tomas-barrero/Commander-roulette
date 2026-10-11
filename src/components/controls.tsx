import type { ReactNode } from 'react'
import type { Difficulty } from '../generator/modifiers'

// Small form controls shared by the settings drawer sections.

export function Skulls({ difficulty }: { difficulty: Difficulty }) {
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

export function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
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
export function Segmented<T extends string>({
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

export function Range({ label, value, min, max, step = 1, display, onChange }: {
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
      <span className="w-20 text-stone-400">{label}</span>
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

export const inputClass = 'rounded border border-stone-600 bg-stone-800 px-2 py-1 text-sm'

/** A setting with a name, difficulty, description, optional on/off switch and parameters. */
export function OptionCard({
  name,
  difficulty,
  description,
  badge,
  enabled,
  disabledReason,
  onToggle,
  children,
}: {
  name: string
  difficulty: Difficulty
  description: string
  badge?: ReactNode
  enabled: boolean
  /** Shown instead of the description, and greys the option out. */
  disabledReason?: string
  /** Leave out for options without an on/off switch. */
  onToggle?: (on: boolean) => void
  children?: ReactNode
}) {
  return (
    <div
      title={disabledReason}
      className={`space-y-2 rounded-lg border p-3 transition ${
        enabled && !disabledReason ? 'border-amber-400/50 bg-amber-400/5' : 'border-stone-700'
      } ${disabledReason ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{name}</span>
            <Skulls difficulty={difficulty} />
            {badge}
          </div>
          <p className="text-xs text-stone-400">{disabledReason ?? description}</p>
        </div>
        {onToggle && <Toggle label={name} checked={enabled} disabled={!!disabledReason} onChange={onToggle} />}
      </div>
      {children}
    </div>
  )
}
