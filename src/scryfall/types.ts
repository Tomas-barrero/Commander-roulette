// Only the Scryfall fields we actually use. See https://scryfall.com/docs/api/cards

export type Colour = 'W' | 'U' | 'B' | 'R' | 'G'

export type Format = 'brawl' | 'standardbrawl'

export interface ImageUris {
  small: string
  normal: string
  large: string
  png: string
  art_crop: string
  border_crop: string
}

export interface CardFace {
  name: string
  mana_cost?: string
  type_line?: string
  oracle_text?: string
  flavor_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  defense?: string
  artist?: string
  image_uris?: ImageUris
}

export interface ScryfallCard {
  object: 'card'
  id: string
  oracle_id?: string
  name: string
  layout: string
  mana_cost?: string
  cmc: number
  type_line?: string
  oracle_text?: string
  flavor_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  defense?: string
  color_identity: Colour[]
  keywords?: string[]
  rarity: string
  set: string
  set_name: string
  released_at: string
  artist?: string
  image_uris?: ImageUris
  card_faces?: CardFace[]
  scryfall_uri: string
  related_uris?: { edhrec?: string }
  edhrec_rank?: number
}

export interface ScryfallList<T> {
  object: 'list'
  total_cards?: number
  has_more: boolean
  next_page?: string
  data: T[]
  warnings?: string[]
}

export interface ScryfallErrorBody {
  object: 'error'
  status: number
  code: string
  details: string
  warnings?: string[]
}

export interface CardSymbol {
  symbol: string
  svg_uri?: string
  english: string
}
