import { getMatchCondition } from './match.js'
import { automaticPredictionDeadline } from './predictionDeadline.js'
import { eventDate } from './tvSchedule.js'

export function canRevealPredictionStats(game, now = new Date()) {
  if (getMatchCondition(game) !== 'normal') return false
  if (game.startedAt || ['finalizado', 'finished'].includes(game.status)) return true
  const automatic = automaticPredictionDeadline(game), stored = eventDate(game.limitePalpites)
  const deadline = Number.isFinite(stored.getTime()) ? Math.max(stored.getTime(), automatic?.getTime() || 0) : Infinity
  return now.getTime() >= deadline
}

export function predictionPercentages(stats) {
  const counts = ['teamA', 'draw', 'teamB'].map((key) => Math.max(0, Number(stats?.[key]) || 0))
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (!total) return { teamA: 0, draw: 0, teamB: 0, total: 0 }
  const raw = counts.map((count) => count * 100 / total), rounded = raw.map(Math.floor)
  const order = raw.map((value, index) => ({ fraction: value - rounded[index], index })).sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  const remainder = 100 - rounded.reduce((sum, value) => sum + value, 0)
  for (let index = 0; index < remainder; index++) rounded[order[index].index]++
  return { teamA: rounded[0], draw: rounded[1], teamB: rounded[2], total }
}
