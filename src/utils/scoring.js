export const POINTS = {
  RESULT: 3,
  PARTIAL_SCORE_MULTIPLIER: 1.2,
  EXACT_SCORE_MULTIPLIER: 1.4,
  MISS: 0,
}

function applyMultiplier(points, multiplier = 1) {
  return Number((points * multiplier).toFixed(1))
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

export function calcularPontuacao(palpiteA, palpiteB, placarA, placarB) {
  const guessA = Number(palpiteA)
  const guessB = Number(palpiteB)
  const finalA = Number(placarA)
  const finalB = Number(placarB)

  if (![guessA, guessB, finalA, finalB].every(Number.isFinite)) {
    return { pontos: POINTS.MISS, acertoExato: false, acertoResultado: false, tipo: 'pendente' }
  }

  const hasCorrectResult = getMatchResult(guessA, guessB) === getMatchResult(finalA, finalB)

  if (!hasCorrectResult) {
    return { pontos: POINTS.MISS, acertoExato: false, acertoResultado: false, tipo: 'erro' }
  }

  if (guessA === finalA && guessB === finalB) {
    return {
      pontos: applyMultiplier(POINTS.RESULT, POINTS.EXACT_SCORE_MULTIPLIER),
      acertoExato: true,
      acertoResultado: false,
      tipo: 'exato',
    }
  }

  if (guessA === finalA || guessB === finalB) {
    return {
      pontos: applyMultiplier(POINTS.RESULT, POINTS.PARTIAL_SCORE_MULTIPLIER),
      acertoExato: false,
      acertoResultado: true,
      tipo: 'placar-parcial',
    }
  }

  return { pontos: POINTS.RESULT, acertoExato: false, acertoResultado: true, tipo: 'resultado' }
}

export function calculateGuessScore(game, guess) {
  if (!hasFinalScore(game) || !guess) {
    return { points: POINTS.MISS, type: 'pending' }
  }

  const finalA = Number(game.placarA ?? game.finalScoreA)
  const finalB = Number(game.placarB ?? game.finalScoreB)
  const guessA = Number(guess.palpiteA ?? guess.guessA)
  const guessB = Number(guess.palpiteB ?? guess.guessB)

  const hasCorrectResult = getMatchResult(guessA, guessB) === getMatchResult(finalA, finalB)

  if (!hasCorrectResult) {
    return { points: POINTS.MISS, type: 'miss' }
  }

  if (guessA === finalA && guessB === finalB) {
    return { points: applyMultiplier(POINTS.RESULT, POINTS.EXACT_SCORE_MULTIPLIER), type: 'exact' }
  }

  if (guessA === finalA || guessB === finalB) {
    return { points: applyMultiplier(POINTS.RESULT, POINTS.PARTIAL_SCORE_MULTIPLIER), type: 'partial-score' }
  }

  return { points: POINTS.RESULT, type: 'result' }
}
