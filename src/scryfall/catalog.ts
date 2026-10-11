import { scryfallGet } from './client'

interface Catalog {
  object: 'catalog'
  data: string[]
}

/** Every creature type Scryfall knows about. Cached for 24h. */
export async function loadCreatureTypes(): Promise<string[]> {
  const catalog = await scryfallGet<Catalog>('/catalog/creature-types', { cache: true })
  return catalog.data
}
