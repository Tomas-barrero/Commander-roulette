import { useState } from 'react'
import { CardDisplay } from './components/CardDisplay'
import { ColourPicker } from './components/ColourPicker'
import { RulesText } from './components/RulesText'
import { DEFAULT_COLOUR_SETTINGS, manualSelectionProblem, type ColourSettings } from './generator/colours'
import { generateCommander, NoCommanderError, type GeneratedCommander } from './generator/commander'
import { ScryfallError } from './scryfall/client'

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
  const [colours, setColours] = useState<ColourSettings>(DEFAULT_COLOUR_SETTINGS)
  const [result, setResult] = useState<GeneratedCommander>()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const problem = manualSelectionProblem(colours)
  const loading = status.kind === 'loading'

  async function generate() {
    setStatus({ kind: 'loading' })
    try {
      setResult(await generateCommander('brawl', colours))
      setStatus({ kind: 'idle' })
    } catch (e) {
      setStatus({ kind: 'error', ...describeError(e) })
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-800 bg-black/30 px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-serif text-2xl font-bold text-amber-100">Commander Roulette</h1>
          <p className="text-sm text-stone-400">A random MTG Arena Brawl commander to build around.</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-6">
        <section className="flex flex-col gap-4 rounded-xl border border-stone-800 bg-stone-900/60 p-4 md:flex-row md:items-end md:justify-between">
          <ColourPicker value={colours} onChange={setColours} />
          <div className="flex flex-col items-stretch gap-1 md:items-end">
            <button
              type="button"
              onClick={generate}
              disabled={loading || !!problem}
              className="rounded-lg bg-amber-400 px-6 py-3 text-lg font-bold text-stone-900 shadow-lg transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Shuffling…' : result ? '🎲 Reroll' : '🎲 Generate commander'}
            </button>
            {problem && <p className="text-sm text-amber-200/80">{problem}</p>}
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
            <section className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
              <CardDisplay key={result.card.id} card={result.card} />
              <RulesText card={result.card} />
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
    </div>
  )
}
