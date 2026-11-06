export const MATCH_STATE = { SCHEDULED: 'scheduled', LIVE: 'live', FINISHED: 'finished' }

export function getMatchState(game) {
  if (['finalizado', 'finished'].includes(game?.status)) return MATCH_STATE.FINISHED
  return game?.liveStatus === MATCH_STATE.LIVE ? MATCH_STATE.LIVE : MATCH_STATE.SCHEDULED
}

export function getMatchScore(game) {
  return getMatchState(game) === MATCH_STATE.FINISHED
    ? [game.placarA ?? '–', game.placarB ?? '–']
    : [game.liveScoreA ?? 0, game.liveScoreB ?? 0]
}
