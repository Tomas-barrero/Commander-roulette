import { useState } from 'react'
import type { HistoryEntry } from '../state/history'
import { ColourPips } from './ManaSymbols'

interface Props {
  history: HistoryEntry[]
  favourites: HistoryEntry[]
  currentKey?: string
  busy: boolean
  onOpen: (entry: HistoryEntry) => void
  onRemoveFavourite: (key: string) => void
  onClearHistory: () => void
}

function EntryCard({ entry, current, busy, onOpen, onRemove }: {
  entry: HistoryEntry
  current: boolean
  busy: boolean
  onOpen: () => void
  onRemove?: () => void
}) {
  const challenges = entry.share.ch.length
  return (
    <li className="relative w-28 sm:w-32">
      <button
        type="button"
        disabled={busy}
        onClick={onOpen}
        title={`Open ${entry.name}`}
        className={`block w-full text-left transition hover:-translate-y-1 disabled:cursor-wait ${current ? 'ring-2 ring-amber-300' : ''}`}
      >
        {entry.image ? (
          <img src={entry.image} alt={entry.name} loading="lazy" className="h-auto w-full" />
        ) : (
          <div className="flex aspect-[488/680] items-center justify-center bg-stone-800 p-2 text-center text-xs">{entry.name}</div>
        )}
      </button>
      <div className="mt-1 flex items-center justify-between gap-1 text-xs text-stone-400">
        <ColourPips colours={entry.identity} size="h-3 w-3" />
        <span title="Challenges">{challenges ? `${challenges} rule${challenges === 1 ? '' : 's'}` : ''}</span>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${entry.name} from favourites`}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-stone-800 text-sm text-stone-300 shadow hover:bg-red-800 hover:text-white"
        >
          ×
        </button>
      )}
    </li>
  )
}

export function HistoryPanel({ history, favourites, currentKey, busy, onOpen, onRemoveFavourite, onClearHistory }: Props) {
  const [tab, setTab] = useState<'recent' | 'favourites'>('recent')
  if (history.length === 0 && favourites.length === 0) return null
  const list = tab === 'recent' ? history : favourites

  return (
    <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['recent', 'favourites'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              tab === t ? 'bg-amber-400 font-semibold text-stone-900' : 'text-stone-300 hover:bg-stone-800'
            }`}
          >
            {t === 'recent' ? `🕘 Recent (${history.length})` : `⭐ Favourites (${favourites.length})`}
          </button>
        ))}
        {tab === 'recent' && history.length > 0 && (
          <button type="button" onClick={onClearHistory} className="ml-auto text-xs text-stone-500 hover:text-stone-200">
            Clear history
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-stone-500">
          {tab === 'favourites' ? 'Star a commander to keep it here.' : 'Nothing yet.'}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-4">
          {list.map((entry) => (
            <EntryCard
              key={entry.key}
              entry={entry}
              current={entry.key === currentKey}
              busy={busy}
              onOpen={() => onOpen(entry)}
              onRemove={tab === 'favourites' ? () => onRemoveFavourite(entry.key) : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
