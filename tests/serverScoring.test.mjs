import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregatePredictionStats, calculateRankingData, predictionInput, profileInput, gameStatsInput, scoringGame } from '../functions/domain/ranking.js'
import { processRanking } from '../functions/processor.js'

const teacher = { id: 'teacher', nome: 'Ana', role: 'user', approvalStatus: 'approved', participaRanking: true }
const game = { id: 'game', sportId: 'football', esporteNome: 'Futebol', status: 'finalizado', placarA: 2, placarB: 1 }
const pick = { id: 'pick', userId: teacher.id, gameId: game.id, palpiteA: 2, palpiteB: 1 }
test('server scoring and reports preserve legacy game field aliases', () => {
  const legacy = { id: 'game', status: 'finished', esporteId: 'football', sportName: 'Futebol', teamA: '9º A', teamB: '9º B', phase: 'Final', dateTime: '2026-11-23T12:00:00-03:00', finalScoreA: '2', finalScoreB: '1' }
  assert.equal(calculateRankingData({ users: [teacher], games: [legacy], predictions: [pick] }).totals.get(teacher.id).pontos, 2)
  assert.equal(scoringGame(legacy).timeA, '9º A')
  assert.equal(scoringGame(legacy).dataHora, legacy.dateTime)
  assert.equal(scoringGame(legacy).fase, 'Final')
})
test('server totals share the scoring rules, ignore duplicate picks and remove revoked accounts', () => {
  const data = { users: [teacher, { ...teacher, id: 'blocked', approvalStatus: 'rejected', pontos: 8 }], games: [game], predictions: [pick, { ...pick, id: 'older', updatedAt: new Date('2020-01-01'), palpiteA: 0 }, { ...pick, id: 'newer', updatedAt: new Date('2026-11-23') }, { ...pick, id: 'blocked-pick', userId: 'blocked' }] }
  const plan = calculateRankingData(data)
  assert.equal(plan.totals.get('teacher').pontos, 2)
  assert.equal(plan.totals.get('blocked').pontos, 0)
  assert.equal(plan.predictionUpdates.find((item) => item.id === 'older').fields.pontos, 0)
  assert.equal(plan.predictionUpdates.find((item) => item.id === 'newer').fields.pontos, 2)
})

test('public favorites contain only counts from approved participants and valid unique picks', () => {
  const users = [teacher, { ...teacher, id: 'b' }, { ...teacher, id: 'blocked', approvalStatus: 'rejected' }]
  const picks = [pick, { ...pick, id: 'repeat' }, { ...pick, id: 'b', userId: 'b', palpiteA: 1, palpiteB: 1 }, { ...pick, id: 'bad', userId: 'blocked' }]
  assert.deepEqual(aggregatePredictionStats(game, picks, users), { teamA: 1, teamB: 0, draw: 1, total: 2 })
  assert.deepEqual(aggregatePredictionStats({ ...game, esporteNome: 'Vôlei' }, [{ ...pick, palpiteA: 3, palpiteB: 1 }], [teacher]), { teamA: 0, teamB: 0, draw: 0, total: 0 })
  assert.equal(predictionInput(pick), predictionInput({ ...pick, pontos: 2, scoreUpdatedAt: new Date() }))
  assert.notEqual(predictionInput(pick), predictionInput({ ...pick, updatedAt: new Date() }))
  assert.equal(profileInput(teacher), profileInput({ ...teacher, pontos: 2, rankingPorEsporte: {} }))
  assert.equal(gameStatsInput(game), gameStatsInput({ ...game, liveScoreA: 20, scoreRevision: 40, updatedAt: new Date() }))
})

test('a superseded server worker cannot overwrite a newer completed calculation', async () => {
  let currentToken, revision = 0, releaseOld, reads = 0
  const saved = new Map()
  const oldData = { users: [teacher], games: [{ ...game, placarA: 0, placarB: 1 }], predictions: [pick] }
  const newData = { users: [teacher], games: [game], predictions: [pick] }
  const store = {
    claim: async (_scope, token) => { currentToken = token; return ++revision },
    readRankingData: async () => ++reads === 1 ? new Promise((resolve) => { releaseOld = () => resolve(oldData) }) : newData,
    commit: async (_scope, token, changes) => { if (token !== currentToken) return false; changes.forEach((item) => saved.set(`${item.collection}/${item.id}`, item.fields)); return true },
    finish: async (_scope, token) => token === currentToken,
    fail: async () => {},
  }
  const old = processRanking(store, 'old')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal((await processRanking(store, 'new')).complete, true)
  releaseOld()
  assert.equal((await old).superseded, true)
  assert.equal(saved.get('users/teacher').pontos, 2)
})

test('server processing bounds writes and does not need an open browser', async () => {
  const users = Array.from({ length: 350 }, (_, index) => ({ ...teacher, id: `u-${index}` }))
  const sizes = []
  const store = { claim: async () => 1, readRankingData: async () => ({ users, games: [game], predictions: users.map((user) => ({ ...pick, id: user.id, userId: user.id })) }), commit: async (_scope, _token, changes) => { sizes.push(changes.length); return true }, finish: async () => true, fail: async () => {} }
  const result = await processRanking(store, 'independent')
  assert.equal(result.complete, true)
  assert.deepEqual(sizes, [300, 300, 100])
})
