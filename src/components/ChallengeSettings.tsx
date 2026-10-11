import { blockedBy, defaultParams, type ChallengeSettings } from '../challenges/conflicts'
import { CHALLENGES } from '../challenges/definitions'
import { CATEGORIES, type ChallengeDefinition, type ParamDef, type ParamValue } from '../challenges/types'
import { inputClass, OptionCard, Range, Segmented } from './controls'

export function TypeBadge({ type }: { type: ChallengeDefinition['type'] }) {
  return type === 'auto' ? (
    <span title="The app generates or checks this with Scryfall" className="rounded bg-sky-900/60 px-1.5 text-[10px] tracking-wide text-sky-200 uppercase">
      auto
    </span>
  ) : (
    <span title="A rule you follow yourself" className="rounded bg-violet-900/60 px-1.5 text-[10px] tracking-wide text-violet-200 uppercase">
      honour
    </span>
  )
}

function ParamControl({ param, value, onChange }: { param: ParamDef; value: ParamValue; onChange: (v: ParamValue) => void }) {
  if (param.kind === 'number') {
    return (
      <Range label={param.label} value={Number(value)} min={param.min} max={param.max} step={param.step} onChange={onChange} />
    )
  }
  if (param.options.length <= 3) {
    return <Segmented value={String(value)} options={param.options} onChange={onChange} />
  }
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="text-stone-400">{param.label}</span>
      <select value={String(value)} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {param.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ChallengeSettingsSection({ value, onChange }: { value: ChallengeSettings; onChange: (v: ChallengeSettings) => void }) {
  const update = (def: ChallengeDefinition, patch: Partial<ChallengeSettings[string]>) => {
    const current = value[def.id] ?? { enabled: false, params: defaultParams(def) }
    onChange({ ...value, [def.id]: { ...current, ...patch } })
  }

  return (
    <>
      {CATEGORIES.map((category) => {
        const defs = CHALLENGES.filter((c) => c.category === category.id)
        if (defs.length === 0) return null
        return (
          <section key={category.id} className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">
              {category.icon} {category.name}
            </h3>
            {defs.map((def) => {
              const state = value[def.id] ?? { enabled: false, params: defaultParams(def) }
              const params = { ...defaultParams(def), ...state.params }
              const blocker = state.enabled ? undefined : blockedBy(def.id, value)
              return (
                <OptionCard
                  key={def.id}
                  name={def.name}
                  difficulty={def.difficulty}
                  description={def.description}
                  badge={<TypeBadge type={def.type} />}
                  enabled={state.enabled}
                  disabledReason={blocker && `Can’t combine with ${blocker.name}.`}
                  onToggle={(enabled) => update(def, { enabled })}
                >
                  {state.enabled &&
                    def.params?.map((p) => (
                      <ParamControl
                        key={p.key}
                        param={p}
                        value={params[p.key]}
                        onChange={(v) => update(def, { params: { ...params, [p.key]: v } })}
                      />
                    ))}
                </OptionCard>
              )
            })}
          </section>
        )
      })}
    </>
  )
}
