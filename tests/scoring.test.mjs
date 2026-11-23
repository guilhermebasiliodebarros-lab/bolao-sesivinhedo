import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularPontuacao, calculateGuessScore, hasFinalScore } from '../src/utils/scoring.js'

for (const esporteNome of ['Futebol', 'Handebol', 'Basquete']) {
  test(`${esporteNome}: one point for the result and one extra only for both exact scores`, () => {
    const cases = [
      [2, 1, 2, 1, 2, true, true, 'exact'],
      [2, 0, 2, 1, 1, false, true, 'result'],
      [3, 0, 2, 1, 1, false, true, 'result'],
      [1, 2, 1, 2, 2, true, true, 'exact'],
      [0, 2, 1, 2, 1, false, true, 'result'],
      [0, 1, 2, 1, 0, false, false, 'miss'],
      [1, 2, 2, 1, 0, false, false, 'miss'],
      [0, 0, 0, 0, 2, true, true, 'exact'],
      [1, 1, 0, 0, 1, false, true, 'result'],
      [2, 1, 1, 1, 0, false, false, 'miss'],
    ]
    for (const [a, b, finalA, finalB, points, exact, outcome, type] of cases) {
      const game = { esporteNome, status: 'finalizado', placarA: finalA, placarB: finalB }
      const result = calcularPontuacao(a, b, finalA, finalB, game)
      assert.equal(result.pontos, points)
      assert.equal(result.acertoExato, exact)
      assert.equal(result.acertoResultado, outcome)
      assert.deepEqual(calculateGuessScore(game, { palpiteA: a, palpiteB: b }), { points, type })
    }
  })
}

test('volleyball awards the bonus for exact sets, never just the number of sets with the wrong winner', () => {
  const scores = [[2, 0], [2, 1], [0, 2], [1, 2]]
  for (const [finalA, finalB] of scores) {
    const game = { esporteNome: 'Vôlei', placarA: finalA, placarB: finalB, setScores: [{ a: 25, b: 10 }] }
    for (const [a, b] of scores) {
      const sameWinner = (a > b) === (finalA > finalB)
      const exact = a === finalA && b === finalB
      const points = sameWinner ? exact ? 2 : 1 : 0
      assert.deepEqual(calculateGuessScore(game, { palpiteA: a, palpiteB: b }), {
        points, type: exact ? 'exact' : sameWinner ? 'result' : 'miss',
      })
    }
  }
  assert.deepEqual(calculateGuessScore({ esporteNome: 'Vôlei', placarA: 2, placarB: 0, volleyballBestOf: 5 }, { palpiteA: 3, palpiteB: 0 }), { points: 0, type: 'pending' })
})

test('chess awards one result point for a win or draw without an exact-score bonus', () => {
  for (const [a, b] of [[1, 0], [0.5, 0.5], [0, 1]]) {
    const game = { esporteNome: 'Xadrez', placarA: a, placarB: b }
    assert.deepEqual(calcularPontuacao(a, b, a, b, game), { pontos: 1, acertoExato: false, acertoResultado: true, tipo: 'resultado' })
    assert.deepEqual(calculateGuessScore(game, { palpiteA: a, palpiteB: b }), { points: 1, type: 'result' })
  }
  assert.deepEqual(calculateGuessScore({ esporteNome: 'Xadrez', placarA: 1, placarB: 0 }, { palpiteA: 0.5, palpiteB: 0.5 }), { points: 0, type: 'miss' })
})

test('missing, invalid, unfinished and voided scores never earn points', () => {
  const game = { esporteNome: 'Futebol', placarA: 0, placarB: 0 }
  assert.equal(hasFinalScore(game), true)
  for (const invalid of [null, undefined, '', '  ', NaN, Infinity, -1, 0.5]) {
    assert.equal(calcularPontuacao(invalid, 0, 0, 0, game).pontos, 0)
    assert.equal(calcularPontuacao(0, 0, invalid, 0, game).pontos, 0)
  }
  assert.deepEqual(calculateGuessScore(game, null), { points: 0, type: 'pending' })
  assert.deepEqual(calculateGuessScore({ esporteNome: 'Futebol' }, { palpiteA: 0, palpiteB: 0 }), { points: 0, type: 'pending' })
  for (const matchCondition of ['cancelled', 'walkover']) {
    assert.deepEqual(calculateGuessScore({ ...game, matchCondition }, { palpiteA: 0, palpiteB: 0 }), { points: 0, type: 'void' })
  }
})

test('legacy score aliases and numeric input strings follow the same scoring rule', () => {
  assert.deepEqual(calculateGuessScore({ esporteNome: 'Basquete', finalScoreA: 72, finalScoreB: 69 }, { guessA: '72', guessB: '69' }), { points: 2, type: 'exact' })
  assert.equal(calcularPontuacao('2', '0', '2', '1').pontos, 1)
})
