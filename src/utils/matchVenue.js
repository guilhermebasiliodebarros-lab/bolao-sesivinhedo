import { normalizeFilterText } from './game.js'

export const venueKey = (value) => normalizeFilterText(value).trim()
export const matchVenueLabel = (game) => [game?.venue, game?.venueArea].filter(Boolean).join(' · ')
export function venuesOverlap(first, second) {
  if (!venueKey(first.venue) || venueKey(first.venue) !== venueKey(second.venue)) return false
  return !venueKey(first.venueArea) || !venueKey(second.venueArea) || venueKey(first.venueArea) === venueKey(second.venueArea)
}
