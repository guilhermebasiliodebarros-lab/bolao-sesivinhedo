import { calendarFingerprint } from './visualSchedule.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { getGameShift } from './schoolShifts.js'

export const deletionFingerprint = (game) => JSON.stringify([calendarFingerprint(game), game.tournamentId || '', game.groupName || '', game.sourceGameIdA || '', game.sourceGameIdB || '', game.nextGameId || '', game.placarA ?? null, game.placarB ?? null])

export function deletionSelection(games, { sportId = '', turno = '', tournamentId = '' }) {
  return games.filter((game) => (!sportId || game.sportId === sportId) && (!turno || getGameShift(game) === turno) && (!tournamentId || game.tournamentId === tournamentId))
}

export function validateDeletionSelection(selected, games) {
  if (!selected.length) throw new Error('Não há jogos nesta seleção.')
  const ids = new Set(selected.map((game) => game.id))
  if (ids.size !== selected.length || selected.some((game) => !game.id)) throw new Error('Confira a lista de jogos antes de excluir.')
  if (selected.some((game) => getMatchState(game) === MATCH_STATE.LIVE)) throw new Error('Há partidas ao vivo nesta seleção. Encerre essas partidas ou escolha outro torneio antes de excluir.')
  if (games.some((game) => !ids.has(game.id) && [game.sourceGameIdA, game.sourceGameIdB, game.nextGameId].some((id) => ids.has(id))) || selected.some((game) => [game.sourceGameIdA, game.sourceGameIdB, game.nextGameId].some((id) => id && !ids.has(id) && games.some((item) => item.id === id)))) throw new Error('Há confrontos fora da seleção ligados a estes jogos. Selecione o torneio completo para manter o chaveamento consistente.')
  return ids
}
