import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateCommanderWithChaos, newChaosPick, runChallengesWithChaos, type ChaosPick } from './challenges/chaos'
import { activeChallenges } from './challenges/conflicts'
import type { ChallengeRun } from './challenges/engine'
import { CardDisplay } from './components/CardDisplay'
import { ChallengeList } from './components/ChallengeList'
import { copyText } from './components/clipboard'
import { ColourPicker } from './components/ColourPicker'
import { HistoryPanel } from './components/HistoryPanel'
import { RulesText } from './components/RulesText'
import { SettingsDrawer } from './components/SettingsDrawer'
import { manualSelectionProblem } from './generator/colours'
import { NoCommanderError, type GeneratedCommander } from './generator/commander'
import { describeModifiers } from './generator/modifiers'
import { ScryfallError } from './scryfall/client'
import { frontImage } from './scryfall/images'
import { arenaDeckList } from './state/arenaExport'
import { FAVOURITES_LIMIT, HISTORY_LIMIT, sameShare, upsertEntry, useEntryList, type HistoryEntry } from './state/history'
import { useSessionState } from './state/session'
import { useSettings, type Settings } from './state/settings'
import {
  buildSharePayload,
  loadSharedChallenge,
  readShareFromHash,
  SHARE_PREFIX,
  settingsFromShare,
  shareUrl,
  type SharePayload,
} from './state/share'

const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; title: string; message: string }

function describeError(e: unknown): { title: string; message: string } {
  if (e instanceof NoCommanderError) return { title: 'No commander matches', message: e.message }
  if (e instanceof ScryfallError && e.status === 429) return { title: 'Scryfall is busy', message: e.message }
  if (e instanceof ScryfallError) return { title: 'Scryfall error', message: e.message }
  return { title: 'Something went wrong', message: e instanceof Error ? e.message : String(e) }
}

export default function App() {
  const [settings, setSettings] = useSettings()
  const [result, setResult] = useSessionState<GeneratedCommander | undefined>('result', undefined)
  const [generations, setGenerations] = useSessionState('generations', 0)
  const [challengeRun, setChallengeRun] = useSessionState<ChallengeRun | undefined>('challenges', undefined)
  const [chaosPick, setChaosPick] = useSessionState<ChaosPick | undefined>('chaos', undefined)
  /** Identifies this roll in history; stays the same while you reroll its challenges. */
  const [entryKey, setEntryKey] = useSessionState<string | undefined>('entry', undefined)
  /** The settings this roll was made with (a shared link carries the sender's). */
  const [rolledWith, setRolledWith] = useSessionState<Settings | undefined>('rolled-with', undefined)
  const [sharedFrom, setSharedFrom] = useState<SharePayload>()
  const [history, setHistory] = useEntryList('commander-roulette:history')
  const [favourites, setFavourites] = useEntryList('commander-roulette:favourites')
  const [toast, setToast] = useState<string>()
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
    activeChallenges(settings.challenges).length +
    (settings.chaos.enabled ? settings.chaos.count : 0)

  // Reroll budget: the first commander of the session is free.
  const budget = settings.modifiers.rerollBudget
  const rerollsLeft = Math.max(0, budget.rerolls - Math.max(0, generations - 1))
  const outOfRerolls = budget.enabled && generations > 0 && rerollsLeft === 0

  /**
   * Roll challenges for a commander, including chaos picks if there are any.
   * `keep` keeps unchanged results; `reroll` re-rolls one challenge; `swap` swaps one chaos pick.
   */
  async function rollChallenges(
    commander: GeneratedCommander,
    s: Settings,
    options: { pick?: ChaosPick; keep?: boolean; reroll?: string; swap?: string } = {},
  ) {
    setChallengeStatus({ kind: 'loading' })
    try {
      const previous = options.keep || options.reroll || options.swap ? challengeRun : undefined
      const { run, pick } = await runChallengesWithChaos(s, commander.card, { ...options, previous })
      setChallengeRun(run)
      setChaosPick(pick)
      setRolledWith(s)
      setChallengeStatus({ kind: 'idle' })
    } catch (e) {
      setChallengeStatus({ kind: 'error', ...describeError(e) })
    }
  }

  async function generate() {
    setStatus({ kind: 'loading' })
    try {
      const { commander, pick } = await generateCommanderWithChaos(settings)
      setResult(commander)
      setChallengeRun(undefined)
      setChaosPick(pick)
      setEntryKey(newKey())
      setRolledWith(settings)
      setSharedFrom(undefined)
      setGenerations((n) => n + 1)
      setStatus({ kind: 'idle' })
      await rollChallenges(commander, settings, { pick })
    } catch (e) {
      setStatus({ kind: 'error', ...describeError(e) })
    }
  }

  /** "Turn it off" on a challenge whose pool is too small. */
  function disableChallenge(id: string) {
    const next = { ...settings, challenges: { ...settings.challenges, [id]: { ...settings.challenges[id], enabled: false } } }
    setSettings(next)
    if (result) rollChallenges(result, next, { keep: true, pick: chaosPick })
  }

  /** "Lock commander & reroll challenges": with chaos on, re-pick the random challenges but keep the commander's modifiers. */
  function rerollAllChallenges(commander: GeneratedCommander) {
    const pick = settings.chaos.enabled ? newChaosPick(settings, Math.random, chaosPick?.modifiers ?? []) : undefined
    rollChallenges(commander, settings, { pick })
  }

  /** Reopen a shared link or a history/favourites entry. Doesn't use up rerolls. */
  async function openPayload(payload: SharePayload, { key, shared = false }: { key: string; shared?: boolean }) {
    setStatus({ kind: 'loading' })
    setChallengeStatus({ kind: 'idle' })
    try {
      const loaded = await loadSharedChallenge(payload)
      setResult(loaded.commander)
      setChallengeRun(loaded.run)
      setChaosPick(loaded.pick)
      setEntryKey(key)
      setRolledWith(settingsFromShare(payload))
      setSharedFrom(shared ? payload : undefined)
      setStatus({ kind: 'idle' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setStatus({ kind: 'error', ...describeError(e) })
    }
  }

  // Open a #share=… link (on load, or when one is pasted into this tab), then tidy the URL.
  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash
      if (!hash.startsWith(SHARE_PREFIX)) return
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      const payload = readShareFromHash(hash)
      if (payload) openPayload(payload, { key: newKey(), shared: true })
      else setStatus({ kind: 'error', title: 'Broken share link', message: 'That link looks cut off or damaged. Ask for it again.' })
    }
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
    // Only on mount: openPayload reads the latest state when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** The current roll as a history entry; also the source of share links and favourites. */
  const currentEntry = useMemo<Omit<HistoryEntry, 'at'> | undefined>(() => {
    if (!result || !entryKey) return undefined
    return {
      key: entryKey,
      name: result.card.name,
      image: frontImage(result.card),
      identity: result.card.color_identity,
      share: buildSharePayload(rolledWith ?? settings, result, challengeRun, chaosPick),
    }
  }, [result, entryKey, rolledWith, settings, challengeRun, chaosPick])

  // Keep the history up to date, once challenges have finished rolling.
  useEffect(() => {
    if (!currentEntry || challengesBusy) return
    setHistory((list) =>
      list.some((e) => e.key === currentEntry.key && sameShare(e.share, currentEntry.share))
        ? list
        : upsertEntry(list, { ...currentEntry, at: Date.now() }, HISTORY_LIMIT),
    )
  }, [currentEntry, challengesBusy, setHistory])

  const isFavourite =
    !!currentEntry && favourites.some((f) => f.key === currentEntry.key && sameShare(f.share, currentEntry.share))
  const mustIncludes = challengeRun?.outcomes.flatMap((o) => o.generated?.cards ?? []) ?? []

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast((t) => (t === message ? undefined : t)), 3000)
  }

  function toggleFavourite() {
    if (!currentEntry) return
    setFavourites((list) =>
      isFavourite
        ? list.filter((f) => f.key !== currentEntry.key)
        : upsertEntry(list, { ...currentEntry, at: Date.now() }, FAVOURITES_LIMIT),
    )
    flash(isFavourite ? 'Removed from favourites.' : 'Saved to favourites.')
  }

  async function copyShareLink() {
    if (!currentEntry) return
    const ok = await copyText(shareUrl(currentEntry.share))
    flash(ok ? 'Share link copied. Send it to a friend!' : 'Couldn’t copy: your browser blocked the clipboard.')
  }

  async function copyForArena() {
    if (!result) return
    const ok = await copyText(arenaDeckList(result.card, mustIncludes))
    flash(ok ? 'Copied! In Arena: Decks → Import.' : 'Couldn’t copy: your browser blocked the clipboard.')
  }

  const actionButton =
    'rounded-lg border border-stone-600 px-4 py-2 text-sm text-stone-200 transition hover:border-amber-300 hover:text-amber-100 disabled:opacity-50'

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
            {result && (activeChallenges(settings.challenges).length > 0 || settings.chaos.enabled) && (
              <button
                type="button"
                onClick={() => rerollAllChallenges(result)}
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
              {sharedFrom && (
                <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-sky-700 bg-sky-950/50 p-3 text-sm text-sky-100">
                  <span>🔗 Someone shared this challenge with you. Rerolling uses your own settings.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSettings(settingsFromShare(sharedFrom))
                      setSharedFrom(undefined)
                      flash('Now using their settings.')
                    }}
                    className="rounded border border-sky-500 px-2 py-0.5 hover:bg-sky-800"
                  >
                    Use their settings
                  </button>
                  <button type="button" onClick={() => setSharedFrom(undefined)} aria-label="Dismiss" className="text-sky-300 hover:text-white">
                    ×
                  </button>
                </div>
              )}
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

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={toggleFavourite}
                  disabled={challengesBusy}
                  aria-pressed={isFavourite}
                  className={actionButton}
                >
                  {isFavourite ? '★ Favourited' : '☆ Favourite'}
                </button>
                <button type="button" onClick={copyShareLink} disabled={challengesBusy} className={actionButton}>
                  🔗 Copy share link
                </button>
                <button
                  type="button"
                  onClick={copyForArena}
                  disabled={challengesBusy}
                  title="Commander + must-include cards in Arena’s import format"
                  className={actionButton}
                >
                  📋 Copy for Arena{mustIncludes.length ? ` (${mustIncludes.length + 1} cards)` : ''}
                </button>
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
                    chaosIds={chaosPick?.challenges}
                    onReroll={(id) => rollChallenges(result, settings, { reroll: id, pick: chaosPick })}
                    onSwap={(id) => rollChallenges(result, settings, { swap: id, pick: chaosPick })}
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

        <HistoryPanel
          history={history}
          favourites={favourites}
          currentKey={entryKey}
          busy={loading || challengesBusy}
          onOpen={(entry) => openPayload(entry.share, { key: entry.key })}
          onRemoveFavourite={(key) => setFavourites((list) => list.filter((f) => f.key !== key))}
          onClearHistory={() => setHistory([])}
        />
      </main>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 shadow-2xl"
        >
          {toast}
        </div>
      )}

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
