const isPredictionVoided = (game) => ['cancelled', 'walkover'].includes(game?.matchCondition)
import { getSportProfile, validateSportScores } from './sportRules.js'
import { hasCorrectTopScorer, usesExactScoreBonus, usesTopScorer } from './predictionPlayers.js'

export const POINTS = {
  RESULT: 1,
  EXACT_SCORE_BONUS: 1,
  TOP_SCORER_BONUS: 1,
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

export function calcularPontuacao(palpiteA, palpiteB, placarA, placarB, game = {}, prediction = {}) {
  let guess, final
  try {
    guess = validateSportScores(game, palpiteA, palpiteB, { final: true })
    final = validateSportScores(game, placarA, placarB, { final: true })
  } catch {
    return { pontos: POINTS.MISS, acertoExato: false, acertoResultado: false, acertoPontuador: false, tipo: 'pendente' }
  }
  const [guessA, guessB] = guess
  const [finalA, finalB] = final

  const hasCorrectResult = getMatchResult(guessA, guessB) === getMatchResult(finalA, finalB)

  const exact = hasCorrectResult && usesExactScoreBonus(game) && guessA === finalA && guessB === finalB
  const scorer = usesTopScorer(game) && hasCorrectTopScorer(game, prediction)
  return {
    pontos: Number(hasCorrectResult) * POINTS.RESULT + Number(exact) * POINTS.EXACT_SCORE_BONUS + Number(scorer) * POINTS.TOP_SCORER_BONUS,
    acertoExato: exact,
    acertoResultado: hasCorrectResult,
    acertoPontuador: scorer,
    tipo: exact ? 'exato' : scorer ? hasCorrectResult ? 'resultado-pontuador' : 'pontuador' : hasCorrectResult ? 'resultado' : 'erro',
  }
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
    guess,
  )
  const types = { exato: 'exact', resultado: 'result', erro: 'miss', pendente: 'pending', 'resultado-pontuador': 'winner-scorer', pontuador: 'scorer' }
  return { points: result.pontos, type: types[result.tipo] }
}

export function getScoringRuleText(game = {}) {
  const mode = getSportProfile(game).scoringMode
  if (mode === 'chess') return `Vencedor ou empate: ${POINTS.RESULT} ponto.`
  const outcomeLabel = mode === 'sets' ? 'Vencedor' : 'Vencedor ou empate'
  if (usesTopScorer(game)) return `${outcomeLabel}: ${POINTS.RESULT} ponto + aluno que mais pontuar na partida: ${POINTS.TOP_SCORER_BONUS} ponto extra (até 2 pontos).`
  if (usesExactScoreBonus(game)) return `${outcomeLabel}: ${POINTS.RESULT} ponto + placar exato: ${POINTS.EXACT_SCORE_BONUS} ponto extra (2 no total).`
  return `${outcomeLabel}: ${POINTS.RESULT} ponto.`
}

export function getScoreTypeLabel(type) {
  const labels = {
    exact: 'Resultado e placar exato (+1 extra)',
    'winner-scorer': 'Sala e aluno corretos (+1 extra)',
    scorer: 'Aluno que mais pontuou (+1 ponto)',
    result: 'Resultado correto',
    miss: 'Palpite sem ponto',
    pending: 'Aguardando resultado',
    void: 'Palpite anulado',
  }

  return labels[type] || labels.pending
}
