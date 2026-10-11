import { useCallback, useState } from 'react'
import { activeChallenges } from './challenges/conflicts'
import { runChallenges, type ChallengeRun } from './challenges/engine'
import { CardDisplay } from './components/CardDisplay'
import { ChallengeList } from './components/ChallengeList'
import { ColourPicker } from './components/ColourPicker'
import { RulesText } from './components/RulesText'
import { SettingsDrawer } from './components/SettingsDrawer'
import { manualSelectionProblem } from './generator/colours'
import { generateCommander, NoCommanderError, type GeneratedCommander } from './generator/commander'
import { describeModifiers } from './generator/modifiers'
import { ScryfallError } from './scryfall/client'
import { useSessionState } from './state/session'
import { useSettings, type Settings } from './state/settings'

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; title: string; message: string }

function describeError(e: unknown): { title: string; message: string } {
  if (e instanceof NoCommanderError) return { title: 'No commander matches', message: e.message }
  if (e instanceof ScryfallError && e.status === 429) {
    return { title: 'Scryfall is busy', message: 'Too many requests. Wait a few seconds and try again.' }
  }
  if (e instanceof ScryfallError) return { title: 'Scryfall error', message: e.message }
  return { title: 'Something went wrong', message: e instanceof Error ? e.message : String(e) }
}

export default function App() {
  const [settings, setSettings] = useSettings()
  const [result, setResult] = useSessionState<GeneratedCommander | undefined>('result', undefined)
  const [generations, setGenerations] = useSessionState('generations', 0)
  const [challengeRun, setChallengeRun] = useSessionState<ChallengeRun | undefined>('challenges', undefined)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [challengeStatus, setChallengeStatus] = useState<Status>({ kind: 'idle' })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const problem = manualSelectionProblem(settings.colours)
  const loading = status.kind === 'loading'
  const challengesBusy = challengeStatus.kind === 'loading'
  const activeCount =
    describeModifiers(settings.modifiers).length +
    (settings.modifiers.rerollBudget.enabled ? 1 : 0) +
    activeChallenges(settings.challenges).length

  // Reroll budget: the first commander of the session is free.
  const budget = settings.modifiers.rerollBudget
  const rerollsLeft = Math.max(0, budget.rerolls - Math.max(0, generations - 1))
  const outOfRerolls = budget.enabled && generations > 0 && rerollsLeft === 0

  /** Roll challenges for a commander. `keep` keeps unchanged results; `reroll` re-rolls just that one. */
  async function rollChallenges(commander: GeneratedCommander, s: Settings, options: { keep?: boolean; reroll?: string } = {}) {
    setChallengeStatus({ kind: 'loading' })
    try {
      const previous = options.keep || options.reroll ? challengeRun : undefined
      setChallengeRun(await runChallenges(s, commander.card, { previous, reroll: options.reroll }))
      setChallengeStatus({ kind: 'idle' })
    } catch (e) {
      setChallengeStatus({ kind: 'error', ...describeError(e) })
    }
  }

  async function generate() {
    setStatus({ kind: 'loading' })
    try {
      const commander = await generateCommander(settings)
      setResult(commander)
      setChallengeRun(undefined)
      setGenerations((n) => n + 1)
      setStatus({ kind: 'idle' })
      await rollChallenges(commander, settings)
    } catch (e) {
      setStatus({ kind: 'error', ...describeError(e) })
    }
  }

  /** "Turn it off" on a challenge whose pool is too small. */
  function disableChallenge(id: string) {
    const next = { ...settings, challenges: { ...settings.challenges, [id]: { ...settings.challenges[id], enabled: false } } }
    setSettings(next)
    if (result) rollChallenges(result, next, { keep: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-800 bg-black/30 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-amber-100">Commander Roulette</h1>
            <p className="text-sm text-stone-400">A random MTG Arena Brawl commander to build around.</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative rounded-lg border border-stone-600 px-4 py-2 text-sm text-stone-200 transition hover:border-amber-300"
          >
            ⚙ Settings
            {activeCount > 0 && (
              <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 px-1.5 text-xs font-bold text-stone-900">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-6">
        <section className="flex flex-col gap-4 rounded-xl border border-stone-800 bg-stone-900/60 p-4 md:flex-row md:items-end md:justify-between">
          <ColourPicker value={settings.colours} onChange={(colours) => setSettings({ ...settings, colours })} />
          <div className="flex flex-col items-stretch gap-1 md:items-end">
            <button
              type="button"
              onClick={generate}
              disabled={loading || !!problem || outOfRerolls}
              className="rounded-lg bg-amber-400 px-6 py-3 text-lg font-bold text-stone-900 shadow-lg transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Shuffling…' : result ? '🎲 Reroll' : '🎲 Generate commander'}
            </button>
            {result && activeChallenges(settings.challenges).length > 0 && (
              <button
                type="button"
                onClick={() => rollChallenges(result, settings)}
                disabled={loading || challengesBusy}
                className="rounded-lg border border-amber-400/60 px-4 py-1.5 text-sm text-amber-100 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🔒 Lock commander & reroll challenges
              </button>
            )}
            {problem && <p className="text-sm text-amber-200/80">{problem}</p>}
            {budget.enabled && result && (
              <p className="text-sm text-stone-400">
                {outOfRerolls ? 'Out of rerolls. You’re building this one! ' : `${rerollsLeft} reroll${rerollsLeft === 1 ? '' : 's'} left. `}
                <button type="button" onClick={() => setGenerations(0)} className="underline hover:text-white">
                  New session
                </button>
              </p>
            )}
          </div>
        </section>

        {status.kind === 'error' && (
          <div role="alert" className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-red-100">
            <p className="font-semibold">{status.title}</p>
            <p className="text-sm">{status.message}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-shuffle aspect-[745/1040] w-48 rounded-[4.5%] border-4 border-amber-900 bg-gradient-to-br from-amber-800 via-stone-900 to-amber-950 shadow-2xl" />
          </div>
        ) : (
          result && (
            <section className="space-y-6">
              {result.restrictions.length > 0 && (
                <ul className="flex flex-wrap justify-center gap-2" aria-label="Commander restrictions">
                  {result.restrictions.map((r) => (
                    <li key={r} className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-sm text-amber-100">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
                <CardDisplay key={result.card.id} card={result.card} />
                <RulesText card={result.card} />
              </div>

              {challengeStatus.kind === 'error' && (
                <div role="alert" className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-red-100">
                  <p className="font-semibold">Couldn’t roll challenges: {challengeStatus.title}</p>
                  <p className="text-sm">{challengeStatus.message}</p>
                </div>
              )}
              {challengesBusy && !challengeRun && (
                <p className="animate-pulse text-center text-stone-400">Rolling your challenges…</p>
              )}
              {challengeRun && challengeRun.outcomes.length > 0 && (
                <div className={challengesBusy ? 'pointer-events-none animate-pulse' : ''}>
                  <ChallengeList
                    run={challengeRun}
                    busy={challengesBusy}
                    onReroll={(id) => rollChallenges(result, settings, { reroll: id })}
                    onDisable={disableChallenge}
                  />
                </div>
              )}
              {!challengeRun && !challengesBusy && challengeStatus.kind === 'idle' && (
                <p className="text-center text-sm text-stone-500">
                  Want it harder? Turn on challenges in ⚙ Settings, then lock the commander and reroll challenges.
                </p>
              )}
            </section>
          )
        )}

        {!result && !loading && status.kind === 'idle' && (
          <p className="py-16 text-center text-stone-500">Pick your colours and hit Generate.</p>
        )}
      </main>

      <footer className="border-t border-stone-800 px-4 py-4 text-center text-xs text-stone-500">
        Commander Roulette is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by
        Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC. Card
        data and images via{' '}
        <a href="https://scryfall.com" className="underline hover:text-stone-300" target="_blank" rel="noreferrer">
          Scryfall
        </a>
        .
      </footer>

      <SettingsDrawer open={drawerOpen} onClose={closeDrawer} settings={settings} onChange={setSettings} />
    </div>
  )
}
