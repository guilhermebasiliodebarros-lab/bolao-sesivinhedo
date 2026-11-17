import { normalizeFilterText } from './game.js'

// Keep official positions when searching; the filtered list is not a new ranking.
export function findRankingEntries(ranking, search = '') {
  const query = normalizeFilterText(search).trim()
  return ranking.map((participant, index) => ({ participant, position: index + 1 }))
    .filter(({ participant }) => !query || normalizeFilterText(participant.nome || participant.email).includes(query))
}
