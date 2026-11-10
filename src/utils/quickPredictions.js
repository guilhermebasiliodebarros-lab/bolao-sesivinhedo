import { getSportProfile, validateSportScores } from './sportRules.js'
import { automaticPredictionDeadline } from './predictionDeadline.js'

export function quickScoreOptions(game) {
  const profile = getSportProfile(game)
  if (profile.scoringMode === 'chess') return [{ a: 1, b: 0 }, { a: .5, b: .5 }, { a: 0, b: 1 }]
  if (profile.scoringMode !== 'sets') return []
  const target = Math.ceil(profile.volleyballBestOf / 2)
  return [true, false].flatMap((homeWins) => Array.from({ length: target }, (_, lost) => ({ a: homeWins ? target : lost, b: homeWins ? lost : target })))
}

export function validQuickScore(game, a, b) {
  try { validateSportScores(game, a, b, { final: true }); return true } catch { return false }
}

export function orderQuickGames(games) {
  return [...games].sort((first, second) => {
    const a = automaticPredictionDeadline(first)?.getTime() ?? Infinity
    const b = automaticPredictionDeadline(second)?.getTime() ?? Infinity
    return a - b || String(first.id).localeCompare(String(second.id))
  })
}
