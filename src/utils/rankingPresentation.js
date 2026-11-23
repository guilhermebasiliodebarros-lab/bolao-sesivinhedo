import { normalizeFilterText } from './game.js'

export function compareRankingScores(first, second) {
  return (Number(second.pontos) || 0) - (Number(first.pontos) || 0)
    || (Number(second.acertosExatos) || 0) - (Number(first.acertosExatos) || 0)
    || (Number(second.acertosResultado) || 0) - (Number(first.acertosResultado) || 0)
}

export function rankingEntries(ranking) {
  let position = 0
  return ranking.map((participant, index) => {
    if (!index || compareRankingScores(participant, ranking[index - 1])) position = index + 1
    return { participant, position }
  })
}

// Keep official positions when searching; the filtered list is not a new ranking.
export function findRankingEntries(ranking, search = '') {
  const query = normalizeFilterText(search).trim()
  return rankingEntries(ranking)
    .filter(({ participant }) => !query || normalizeFilterText(participant.nome || participant.email).includes(query))
}
