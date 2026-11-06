import { canUseTieBreak } from './tieBreak.js'

export const MATCH_STATE = { SCHEDULED: 'scheduled', LIVE: 'live', FINISHED: 'finished', POSTPONED: 'postponed', CANCELLED: 'cancelled' }

export function getMatchCondition(game) { return ['postponed', 'cancelled', 'walkover'].includes(game?.matchCondition) ? game.matchCondition : 'normal' }
export function isPredictionVoided(game) { return ['walkover', 'cancelled'].includes(getMatchCondition(game)) }

export function getMatchState(game) {
  if (getMatchCondition(game) === 'postponed') return MATCH_STATE.POSTPONED
  if (getMatchCondition(game) === 'cancelled') return MATCH_STATE.CANCELLED
  if (['finalizado', 'finished'].includes(game?.status)) return MATCH_STATE.FINISHED
  return game?.liveStatus === MATCH_STATE.LIVE ? MATCH_STATE.LIVE : MATCH_STATE.SCHEDULED
}

export function getMatchOutcome(game) {
  if (getMatchState(game) !== MATCH_STATE.FINISHED) return null
  if (getMatchCondition(game) === 'walkover') return ['A', 'B'].includes(game.walkoverWinner) ? game.walkoverWinner : null
  if (!Number.isFinite(game.placarA) || !Number.isFinite(game.placarB)) return null
  if (game.placarA !== game.placarB) return game.placarA > game.placarB ? 'A' : 'B'
  if (canUseTieBreak(game) && game.tieBreak && Number.isFinite(game.tieBreak.scoreA) && Number.isFinite(game.tieBreak.scoreB) && game.tieBreak.scoreA !== game.tieBreak.scoreB) return game.tieBreak.scoreA > game.tieBreak.scoreB ? 'A' : 'B'
  return 'draw'
}

export function getMatchLabel(game) {
  const condition = getMatchCondition(game)
  if (condition === 'walkover') return 'Vitória por W.O.'
  return ({ scheduled: 'Agendado', live: 'Ao vivo', finished: 'Resultado final', postponed: 'Adiado', cancelled: 'Cancelado' })[getMatchState(game)]
}

export function getWalkoverWinnerName(game) { return ['A', 'B'].includes(game?.walkoverWinner) ? game[`time${game.walkoverWinner}`] : '' }

export function getMatchScore(game) {
  return getMatchState(game) === MATCH_STATE.FINISHED
    ? [game.placarA ?? '–', game.placarB ?? '–']
    : [game.liveScoreA ?? 0, game.liveScoreB ?? 0]
}
