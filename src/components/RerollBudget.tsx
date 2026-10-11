import type { CommanderModifiers } from '../generator/modifiers'

type Budget = CommanderModifiers['rerollBudget']

interface Props {
  budget: Budget
  onChange: (budget: Budget) => void
  /** Commanders rolled since the budget started (the first one is free). */
  rolls: number
  onNewSession: () => void
}

const stepButton =
  'h-7 w-7 rounded-full border border-stone-600 text-stone-200 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Set the reroll budget before rolling. Once you've rolled with a budget it
 * locks (no topping up mid-run) until you start a new session.
 */
export function RerollBudget({ budget, onChange, rolls, onNewSession }: Props) {
  const locked = budget.enabled && rolls > 0

  if (locked) {
    const left = Math.max(0, budget.rerolls - Math.max(0, rolls - 1))
    return (
      <p className="text-sm text-stone-300" aria-live="polite">
        {left === 0 ? (
          <span className="text-amber-200">🔒 Out of rerolls. You’re building this one!</span>
        ) : (
          <span>
            🎲 <strong className="text-amber-100">{left}</strong> of {budget.rerolls} reroll{budget.rerolls === 1 ? '' : 's'} left
          </span>
        )}{' '}
        <button type="button" onClick={onNewSession} className="text-stone-400 underline hover:text-white">
          New session
        </button>
      </p>
    )
  }

  const setRerolls = (rerolls: number) => onChange({ ...budget, rerolls: Math.min(20, Math.max(0, rerolls)) })

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-stone-300">
      <span className="text-stone-400">Reroll budget</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-stone-600">
        {([false, true] as const).map((enabled) => (
          <button
            key={String(enabled)}
            type="button"
            aria-pressed={budget.enabled === enabled}
            onClick={() => onChange({ ...budget, enabled })}
            className={`px-2.5 py-0.5 transition ${
              budget.enabled === enabled ? 'bg-amber-400 font-semibold text-stone-900' : 'hover:bg-stone-700'
            }`}
          >
            {enabled ? 'Limited' : 'Unlimited'}
          </button>
        ))}
      </div>
      {budget.enabled && (
        <span className="flex items-center gap-2">
          <button type="button" aria-label="Fewer rerolls" disabled={budget.rerolls <= 0} onClick={() => setRerolls(budget.rerolls - 1)} className={stepButton}>
            −
          </button>
          <span className="w-6 text-center font-semibold text-amber-100 tabular-nums" aria-label="Rerolls allowed">
            {budget.rerolls}
          </span>
          <button type="button" aria-label="More rerolls" disabled={budget.rerolls >= 20} onClick={() => setRerolls(budget.rerolls + 1)} className={stepButton}>
            +
          </button>
          <span className="text-xs text-stone-500">after your first roll</span>
        </span>
      )}
    </div>
  )
}
