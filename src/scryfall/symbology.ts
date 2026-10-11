import { scryfallGet } from './client'
import type { CardSymbol, ScryfallList } from './types'

export type SymbolMap = Record<string, CardSymbol>

let pending: Promise<SymbolMap> | undefined

/** All mana/rules symbols keyed by their text form, e.g. "{W/U}". Cached for 24h. */
export function loadSymbols(): Promise<SymbolMap> {
  pending ??= scryfallGet<ScryfallList<CardSymbol>>('/symbology', { cache: true })
    .then((list) => Object.fromEntries(list.data.map((s) => [s.symbol, s])))
    .catch((e) => {
      pending = undefined // allow a retry later
      throw e
    })
  return pending
}
