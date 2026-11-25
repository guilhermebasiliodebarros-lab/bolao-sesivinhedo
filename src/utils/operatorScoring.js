import { canonical, gameScoringInput, gameStatsInput, predictionInput, profileInput } from '../../functions/domain/ranking.js'
import { canRevealPredictionStats } from './predictionStats.js'

const ordered = (items) => [...items].sort((a, b) => a.id.localeCompare(b.id))
const profiles = (users) => ordered(users).map((user) => [user.id, profileInput(user)])

export function operatorScoringKey({ users, games, predictions }) {
  const finished = games.filter((game) => ['finalizado', 'finished'].includes(game.status))
  const ids = new Set(finished.map((game) => game.id))
  return canonical([2, profiles(users), ordered(finished).map((game) => [game.id, gameScoringInput(game)]), ordered(predictions.filter((pick) => ids.has(pick.gameId))).map((pick) => [pick.id, predictionInput(pick)])])
}

export function operatorStatsKey({ users, games, predictions }, now = new Date()) {
  const revealed = games.filter((game) => canRevealPredictionStats(game, now))
  const ids = new Set(revealed.map((game) => game.id))
  return canonical([profiles(users), ordered(revealed).map((game) => [game.id, gameStatsInput(game)]), ordered(predictions.filter((pick) => ids.has(pick.gameId))).map((pick) => [pick.id, predictionInput(pick)])])
}
