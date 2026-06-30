export const POINTS = {
  EXACT_SCORE: 3,
  RESULT: 1,
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

export function calcularPontuacao(palpiteA, palpiteB, placarA, placarB) {
  const guessA = Number(palpiteA)
  const guessB = Number(palpiteB)
  const finalA = Number(placarA)
  const finalB = Number(placarB)

  if (![guessA, guessB, finalA, finalB].every(Number.isFinite)) {
    return { pontos: POINTS.MISS, acertoExato: false, acertoResultado: false, tipo: 'pendente' }
  }

  if (guessA === finalA && guessB === finalB) {
    return { pontos: POINTS.EXACT_SCORE, acertoExato: true, acertoResultado: false, tipo: 'exato' }
  }

  if (getMatchResult(guessA, guessB) === getMatchResult(finalA, finalB)) {
    return { pontos: POINTS.RESULT, acertoExato: false, acertoResultado: true, tipo: 'resultado' }
  }

  return { pontos: POINTS.MISS, acertoExato: false, acertoResultado: false, tipo: 'erro' }
}

export function calculateGuessScore(game, guess) {
  if (!hasFinalScore(game) || !guess) {
    return { points: POINTS.MISS, type: 'pending' }
  }

  const finalA = Number(game.placarA ?? game.finalScoreA)
  const finalB = Number(game.placarB ?? game.finalScoreB)
  const guessA = Number(guess.palpiteA ?? guess.guessA)
  const guessB = Number(guess.palpiteB ?? guess.guessB)

  if (guessA === finalA && guessB === finalB) {
    return { points: POINTS.EXACT_SCORE, type: 'exact' }
  }

  if (getMatchResult(guessA, guessB) === getMatchResult(finalA, finalB)) {
    return { points: POINTS.RESULT, type: 'result' }
  }

  return { points: POINTS.MISS, type: 'miss' }
}
