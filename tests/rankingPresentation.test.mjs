import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareRankingScores, findRankingEntries, rankingEntries } from '../src/utils/rankingPresentation.js'

test('complete ties share competition positions and keep them when searching', () => {
  const ranking = [
    { id: 'a', nome: 'Ana', pontos: 8, acertosExatos: 3, acertosResultado: 5 },
    { id: 'j', nome: 'João', pontos: 8, acertosExatos: 3, acertosResultado: 5 },
    { id: 'm', nome: 'Maria', pontos: 8, acertosExatos: 2, acertosResultado: 6 },
    { id: 'p', nome: 'Paulo', pontos: 7, acertosExatos: 2, acertosResultado: 5 },
    { id: 'r', nome: 'Rita', pontos: 7, acertosExatos: 2, acertosResultado: 5 },
    { id: 's', nome: 'Sofia', pontos: 0 },
  ]
  assert.deepEqual(rankingEntries(ranking).map((entry) => entry.position), [1, 1, 3, 4, 4, 6])
  assert.deepEqual(findRankingEntries(ranking, 'joao'), [{ participant: ranking[1], position: 1 }])
  assert.deepEqual(findRankingEntries(ranking, 'rita'), [{ participant: ranking[4], position: 4 }])
  assert.equal(compareRankingScores(ranking[0], ranking[1]), 0)
  assert.notEqual(compareRankingScores(ranking[1], ranking[2]), 0)
})

test('zero-point participants all share first place and undefined totals mean zero', () => {
  assert.deepEqual(rankingEntries([{ nome: 'Ana' }, { nome: 'Bruno', pontos: 0, acertosExatos: 0 }, { nome: 'Carla', pontos: 0 }]).map((entry) => entry.position), [1, 1, 1])
  assert.deepEqual(rankingEntries([]), [])
  assert.notEqual(compareRankingScores({ pontos: 2, acertosExatos: 1, acertosResultado: 1 }, { pontos: 2, acertosExatos: 1, acertosResultado: 2 }), 0)
})
