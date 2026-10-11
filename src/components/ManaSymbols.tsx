import { useEffect, useState, type ReactNode } from 'react'
import { loadSymbols, type SymbolMap } from '../scryfall/symbology'
import type { Colour } from '../scryfall/types'

/** Loads Scryfall's symbol SVGs once (cached for 24h). Empty until loaded. */
function useSymbols(): SymbolMap {
  const [symbols, setSymbols] = useState<SymbolMap>({})
  useEffect(() => {
    let alive = true
    loadSymbols()
      .then((map) => alive && setSymbols(map))
      .catch(() => {
        // Fall back to the text form of symbols, e.g. "{W}"
      })
    return () => {
      alive = false
    }
  }, [])
  return symbols
}

function SymbolIcon({ token, symbols, size }: { token: string; symbols: SymbolMap; size: string }) {
  const symbol = symbols[token]
  if (!symbol?.svg_uri) return <span className="font-mono text-sm">{token}</span>
  return (
    <img
      src={symbol.svg_uri}
      alt={token}
      title={symbol.english}
      className={`inline-block align-[-0.15em] ${size} mx-[0.05em]`}
    />
  )
}

/** Renders text like "{2}{W}: Draw a card." with real mana symbols. */
function withSymbols(text: string, symbols: SymbolMap, size: string): ReactNode[] {
  return text
    .split(/(\{[^}]+\})/)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith('{') ? <SymbolIcon key={i} token={part} symbols={symbols} size={size} /> : part,
    )
}

/** A mana cost such as "{3}{G}{G}". */
export function ManaCost({ cost }: { cost: string }) {
  const symbols = useSymbols()
  return <span className="whitespace-nowrap">{withSymbols(cost, symbols, 'h-5 w-5')}</span>
}

/** Oracle text: one paragraph per line, reminder text in italics, symbols inline. */
export function OracleText({ text }: { text: string }) {
  const symbols = useSymbols()
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => (
        <p key={i}>
          {line
            .split(/(\([^)]*\))/)
            .filter(Boolean)
            .map((part, j) =>
              part.startsWith('(') ? (
                <i key={j} className="text-stone-400">
                  {withSymbols(part, symbols, 'h-[1em] w-[1em]')}
                </i>
              ) : (
                <span key={j}>{withSymbols(part, symbols, 'h-[1em] w-[1em]')}</span>
              ),
            )}
        </p>
      ))}
    </div>
  )
}

/** A colour identity as pips; colourless shows the {C} symbol. */
export function ColourPips({ colours, size = 'h-6 w-6' }: { colours: Colour[]; size?: string }) {
  const symbols = useSymbols()
  const tokens = colours.length ? colours.map((c) => `{${c}}`) : ['{C}']
  return (
    <span className="inline-flex gap-1">
      {tokens.map((t) => (
        <SymbolIcon key={t} token={t} symbols={symbols} size={size} />
      ))}
    </span>
  )
}
