import { test } from 'node:test'
import assert from 'node:assert/strict'
import { operatorScoringKey, operatorStatsKey } from '../src/utils/operatorScoring.js'

const user = { id: 'teacher', role: 'user', approvalStatus: 'approved', participaRanking: true }
const game = { id: 'match', esporteNome: 'Basquete', sportId: 'basket', status: 'aberto', dataHora: '2099-11-25T15:00:00Z', limitePalpites: '2099-11-25T14:55:00Z' }
const prediction = { id: 'pick', gameId: 'match', userId: 'teacher', palpiteA: 2, palpiteB: 1 }
const data = { users: [user], games: [game], predictions: [prediction] }

test('operator processing does not rescore for points in live games or picks before their deadline', () => {
  const key = operatorScoringKey(data), stats = operatorStatsKey(data, new Date('2026-11-25'))
  const changed = { ...data, games: [{ ...game, liveScoreA: 10, scorerStats: [{ playerId: 'a', side: 'A', total: 10 }] }], predictions: [{ ...prediction, palpiteA: 90 }] }
  assert.equal(operatorScoringKey(changed), key)
  assert.equal(operatorStatsKey(changed, new Date('2026-11-25')), stats)
})

test('final results, selected students, authorship corrections and approval changes request a fresh calculation', () => {
  const final = { ...data, games: [{ ...game, status: 'finalizado', placarA: 2, placarB: 1 }] }
  const key = operatorScoringKey(final)
  assert.notEqual(operatorScoringKey({ ...final, predictions: [{ ...prediction, topScorerPlayerId: 'gustavo', topScorerTeamId: 'team-a', topScorerSide: 'A' }] }), key)
  assert.notEqual(operatorScoringKey({ ...final, games: [{ ...final.games[0], scorerStats: [{ side: 'A', playerId: 'gustavo', total: 12 }] }] }), key)
  assert.notEqual(operatorScoringKey({ ...final, users: [{ ...user, approvalStatus: 'rejected' }] }), key)
  assert.notEqual(operatorScoringKey({ ...final, games: [game] }), key)
  assert.equal(operatorScoringKey({ ...final, users: [{ ...user, pontos: 2, acertosPontuador: 1, scoreUpdatedAt: new Date() }], predictions: [{ ...prediction, pontos: 2, acertoPontuador: true, scoreUpdatedAt: new Date() }] }), key)
})

test('the deadline reveals favorites without requiring a new game event or reordering the same records', () => {
  assert.notEqual(operatorStatsKey(data, new Date('2099-11-25T14:54:00Z')), operatorStatsKey(data, new Date('2099-11-25T14:56:00Z')))
  const two = { users: [user, { ...user, id: 'other' }], games: [game, { ...game, id: 'other-match', status: 'finalizado' }], predictions: [prediction, { ...prediction, id: 'other-pick', gameId: 'other-match' }] }
  const reordered = Object.fromEntries(Object.entries(two).map(([name, items]) => [name, [...items].reverse()]))
  assert.equal(operatorScoringKey(two), operatorScoringKey(reordered))
})
