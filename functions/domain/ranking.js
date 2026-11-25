import { calcularPontuacao, getMatchResult } from './scoring.js'
import { validateSportScores } from './sportRules.js'

export const approvedParticipant = (user) => user?.role === 'user' && user.approvalStatus === 'approved' && user.participaRanking === true
export const canonical = (value) => value instanceof Date ? JSON.stringify(value.toISOString()) : typeof value?.toMillis === 'function' ? JSON.stringify(value.toMillis()) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value)
export const scoringSportKey = (game) => (String(game.sportId || game.esporteId || game.esporteNome || 'geral').trim() || 'geral').replace(/[./[\]~*]/g, '-')
const finalScore = (value) => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value)
export const scoringGame = (game) => ({ ...game, sportId: game.sportId || game.esporteId || '', esporteNome: game.esporteNome || game.sportName || game.nomeEsporte || 'Geral', timeA: game.timeA || game.teamA || '', timeB: game.timeB || game.teamB || '', fase: game.fase || game.phase || 'Fase única', rodada: game.rodada || game.round || '', dataHora: game.dataHora || game.dateTime || '', tournamentName: game.tournamentName || game.nomeTorneio || '', placarA: finalScore(game.placarA ?? game.finalScoreA), placarB: finalScore(game.placarB ?? game.finalScoreB) })
const timestamp = (value) => value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : typeof value === 'string' ? new Date(value).getTime() || 0 : 0)
export function uniquePredictions(predictions) {
  const byGameAndUser = new Map()
  for (const prediction of predictions) {
    const key = JSON.stringify([prediction.userId, prediction.gameId])
    const previous = byGameAndUser.get(key)
    if (!previous || timestamp(prediction.updatedAt) > timestamp(previous.updatedAt) || (timestamp(prediction.updatedAt) === timestamp(previous.updatedAt) && String(prediction.id) > String(previous.id))) byGameAndUser.set(key, prediction)
  }
  return byGameAndUser
}

export function calculateRankingData({ users, games, predictions }) {
  const gameMap = new Map(games.map((game) => [game.id, scoringGame(game)]))
  const participants = new Set(users.filter(approvedParticipant).map((user) => user.id))
  const selected = new Set([...uniquePredictions(predictions).values()].map((prediction) => prediction.id))
  const totals = new Map(users.map((user) => [user.id, { pontos: 0, acertosExatos: 0, acertosResultado: 0, acertosPontuador: 0, rankingPorEsporte: {} }]))
  const predictionUpdates = []
  for (const prediction of predictions) {
    const game = gameMap.get(prediction.gameId)
    const eligible = game && ['finalizado', 'finished'].includes(game.status) && !['cancelled', 'walkover', 'postponed'].includes(game.matchCondition) && participants.has(prediction.userId) && selected.has(prediction.id)
    const result = eligible ? calcularPontuacao(prediction.palpiteA ?? prediction.guessA, prediction.palpiteB ?? prediction.guessB, game.placarA, game.placarB, game, prediction) : { pontos: 0, acertoExato: false, acertoResultado: false, acertoPontuador: false }
    const fields = { pontos: result.pontos, acertoExato: result.acertoExato, acertoResultado: result.acertoResultado, acertoPontuador: result.acertoPontuador }
    if (Object.entries(fields).some(([key, value]) => prediction[key] !== value)) predictionUpdates.push({ id: prediction.id, fields })
    if (!eligible) continue
    const user = totals.get(prediction.userId), key = scoringSportKey(game)
    const sport = user.rankingPorEsporte[key] ||= { sportId: game.sportId || key, esporteNome: game.esporteNome, pontos: 0, acertosExatos: 0, acertosResultado: 0, acertosPontuador: 0 }
    for (const target of [user, sport]) { target.pontos += result.pontos; target.acertosExatos += Number(result.acertoExato); target.acertosResultado += Number(result.acertoResultado); target.acertosPontuador += Number(result.acertoPontuador) }
  }
  const userUpdates = users.filter((user) => Object.entries(totals.get(user.id)).some(([key, value]) => canonical(user[key] ?? (key === 'rankingPorEsporte' ? {} : 0)) !== canonical(value))).map((user) => ({ id: user.id, fields: totals.get(user.id) }))
  return { predictionUpdates, userUpdates, totals }
}

export function aggregatePredictionStats(game, predictions, users) {
  const approved = new Set(users.filter(approvedParticipant).map((user) => user.id))
  const counts = { teamA: 0, draw: 0, teamB: 0, total: 0 }
  for (const prediction of uniquePredictions(predictions).values()) {
    if (prediction.gameId !== game.id || !approved.has(prediction.userId)) continue
    try {
      const [a, b] = validateSportScores(scoringGame(game), prediction.palpiteA ?? prediction.guessA, prediction.palpiteB ?? prediction.guessB, { final: true })
      counts[getMatchResult(a, b)]++; counts.total++
    } catch { /* Invalid historical picks do not enter public percentages. */ }
  }
  return counts
}

const select = (value, keys) => canonical(Object.fromEntries(keys.map((key) => [key, value?.[key] ?? null])))
export const predictionInput = (value) => select(value, ['userId', 'gameId', 'palpiteA', 'palpiteB', 'guessA', 'guessB', 'topScorerTeamId', 'topScorerPlayerId', 'topScorerSide', 'updatedAt'])
export const profileInput = (value) => select(value, ['role', 'approvalStatus', 'participaRanking'])
export const gameScoringInput = (value) => select({ ...value, scorerStats: ['finalizado', 'finished'].includes(value?.status) ? value.scorerStats : null, eventsAdjusted: ['finalizado', 'finished'].includes(value?.status) ? value.eventsAdjusted : null }, ['status', 'placarA', 'placarB', 'finalScoreA', 'finalScoreB', 'sportId', 'esporteId', 'esporteNome', 'sportName', 'nomeEsporte', 'scoringMode', 'matchCondition', 'teamIdA', 'teamIdB', 'scorerStats', 'eventsAdjusted'])
export const gameStatsInput = (value) => select(value, ['scoringMode', 'esporteNome', 'sportName', 'nomeEsporte', 'volleyballBestOf', 'status', 'matchCondition', 'startedAt', 'limitePalpites', 'dataHora', 'dateTime'])
