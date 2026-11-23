const isPredictionVoided = (game) => ['cancelled', 'walkover'].includes(game?.matchCondition)
import { getSportProfile, validateSportScores } from './sportRules.js'

export const POINTS = {
  RESULT: 1,
  EXACT_SCORE_BONUS: 1,
  MISS: 0,
}

export function hasFinalScore(game) {
  const scoreA = game?.placarA ?? game?.finalScoreA
  const scoreB = game?.placarB ?? game?.finalScoreB

  return Number.isFinite(scoreA) && Number.isFinite(scoreB)
}

export function getMatchResult(scoreA, scoreB) {
  if (scoreA > scoreB) {
    return 'teamA'
  }

  if (scoreB > scoreA) {
    return 'teamB'
  }

  return 'draw'
}

export function calcularPontuacao(palpiteA, palpiteB, placarA, placarB, game = {}) {
  let guess, final
  try {
    guess = validateSportScores(game, palpiteA, palpiteB, { final: true })
    final = validateSportScores(game, placarA, placarB, { final: true })
  } catch {
    return { pontos: POINTS.MISS, acertoExato: false, acertoResultado: false, tipo: 'pendente' }
  }
  const [guessA, guessB] = guess
  const [finalA, finalB] = final

  const hasCorrectResult = getMatchResult(guessA, guessB) === getMatchResult(finalA, finalB)

  if (!hasCorrectResult) {
    return { pontos: POINTS.MISS, acertoExato: false, acertoResultado: false, tipo: 'erro' }
  }

  if (getSportProfile(game).scoringMode !== 'chess' && guessA === finalA && guessB === finalB) {
    return {
      pontos: POINTS.RESULT + POINTS.EXACT_SCORE_BONUS,
      acertoExato: true,
      acertoResultado: true,
      tipo: 'exato',
    }
  }

  return { pontos: POINTS.RESULT, acertoExato: false, acertoResultado: true, tipo: 'resultado' }
}

export function calculateGuessScore(game, guess) {
  if (isPredictionVoided(game)) return { points: POINTS.MISS, type: 'void' }
  if (!hasFinalScore(game) || !guess) {
    return { points: POINTS.MISS, type: 'pending' }
  }

  const result = calcularPontuacao(
    guess.palpiteA ?? guess.guessA,
    guess.palpiteB ?? guess.guessB,
    game.placarA ?? game.finalScoreA,
    game.placarB ?? game.finalScoreB,
    game,
  )
  const types = { exato: 'exact', resultado: 'result', erro: 'miss', pendente: 'pending' }
  return { points: result.pontos, type: types[result.tipo] }
}

export function getScoringRuleText(game = {}) {
  const mode = getSportProfile(game).scoringMode
  if (mode === 'chess') return `Vencedor ou empate: ${POINTS.RESULT} ponto.`
  const exactLabel = mode === 'sets' ? 'placar exato em sets' : 'placar exato'
  const outcomeLabel = mode === 'sets' ? 'Vencedor' : 'Vencedor ou empate'
  return `${outcomeLabel}: ${POINTS.RESULT} ponto + ${exactLabel}: ${POINTS.EXACT_SCORE_BONUS} ponto extra (${POINTS.RESULT + POINTS.EXACT_SCORE_BONUS} no total).`
}

export function getScoreTypeLabel(type, game = {}) {
  const labels = {
    exact: getSportProfile(game).scoringMode === 'sets' ? 'Vencedor e sets exatos (+1 extra)' : 'Resultado e placar exato (+1 extra)',
    result: 'Resultado correto',
    miss: 'Palpite sem ponto',
    pending: 'Aguardando resultado',
    void: 'Palpite anulado',
  }

  return labels[type] || labels.pending
}
