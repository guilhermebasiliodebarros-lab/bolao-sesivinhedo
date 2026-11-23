import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGlobalSearchIndex, searchGlobalIndex } from '../src/utils/globalSearch.js'
import { canRevealPredictionStats, predictionPercentages } from '../src/utils/predictionStats.js'
import { buildResultImpact } from '../src/utils/resultImpact.js'
import { buildFinalReport } from '../src/utils/finalReport.js'
import { processRanking } from '../functions/processor.js'

const game = { id: 'g', sportId: 'football', esporteNome: 'Futebol', scoringMode: 'goals', tournamentId: 'cup', tournamentName: 'Copa', turno: 'manha', timeA: '9º A', timeB: '9º B', status: 'finalizado', liveStatus: 'finished', placarA: 2, placarB: 1, scoreRevision: 2, stageType: 'group', groupName: 'Grupo A', fase: 'Fase de grupos', dataHora: new Date('2026-11-23T15:00:00Z'), limitePalpites: new Date('2026-11-23T14:55:00Z') }
const user = { id: 'u', nome: 'Professor A', role: 'user', approvalStatus: 'approved', participaRanking: true }
const users = [user, { ...user, id: 'v', nome: 'Professor B' }, { ...user, id: 'blocked', approvalStatus: 'rejected' }]
const predictions = [{ id: 'p', userId: 'u', gameId: 'g', palpiteA: 2, palpiteB: 1 }, { id: 'q', userId: 'v', gameId: 'g', palpiteA: 0, palpiteB: 1 }]
const next = { ...game, id: 'f', status: 'aberto', liveStatus: 'scheduled', stageType: 'knockout', groupName: '', fase: 'Final', placarA: null, placarB: null, sourceGameIdA: 'g', timeB: '8º A' }

test('global search supports accents, class aliases, multiple terms and role-specific destinations', () => {
  const teams = [{ id: 't', nome: '9º A', sportId: game.sportId, esporteNome: 'Futebol' }]
  const players = [{ id: 'p', teamId: 't', nome: 'João Henrique Silva' }]
  const data = { games: [game], teams, players }
  const admin = buildGlobalSearchIndex({ ...data, isMaster: true })
  assert.equal(searchGlobalIndex(admin, 'joao silva')[0].tab, 'jogadores')
  assert.equal(searchGlobalIndex(admin, '9a futebol')[0].view, 'admin')
  assert.equal(searchGlobalIndex(admin, 'não existe').length, 0)
  const teacher = buildGlobalSearchIndex(data)
  assert.equal(searchGlobalIndex(teacher, 'joao').length, 0)
  assert(teacher.every((item) => item.view === 'jogos'))
  const viewer = buildGlobalSearchIndex({ ...data, isViewer: true, games: [{ ...game, scorerStats: [{ side: 'A', playerId: 'p', playerName: 'João Henrique Silva', total: 2 }] }] })
  assert.equal(searchGlobalIndex(viewer, 'henrique').length, 0)
  assert.equal(searchGlobalIndex(viewer, 'joao')[0].label, 'João')
  assert.equal(searchGlobalIndex(viewer, 'joao')[0].view, 'estatisticas')
})

test('empty search prioritizes live games and includes only future scheduled games', () => {
  const now = new Date('2026-11-23T14:00:00Z')
  const games = [game, { ...game, id: 'future', status: 'aberto', liveStatus: 'scheduled' }, { ...game, id: 'old', status: 'aberto', liveStatus: 'scheduled', dataHora: new Date('2026-11-22') }, { ...game, id: 'live', status: 'encerrado', liveStatus: 'live' }]
  assert.deepEqual(searchGlobalIndex(buildGlobalSearchIndex({ games }), '', 30, now).map((item) => item.id), ['live', 'future'])
})

test('favorites remain hidden before the cutoff, when rescheduled and for void matches', () => {
  const scheduled = { ...game, status: 'aberto', liveStatus: 'scheduled' }
  assert.equal(canRevealPredictionStats(scheduled, new Date('2026-11-23T14:54:59Z')), false)
  assert.equal(canRevealPredictionStats(scheduled, new Date('2026-11-23T14:55:00Z')), true)
  assert.equal(canRevealPredictionStats({ ...scheduled, limitePalpites: new Date('2026-11-23T14:59:00Z') }, new Date('2026-11-23T14:56:00Z')), false)
  assert.equal(canRevealPredictionStats({ ...scheduled, limitePalpites: new Date('2026-11-23T14:00:00Z') }, new Date('2026-11-23T14:01:00Z')), false)
  assert.equal(canRevealPredictionStats({ ...scheduled, limitePalpites: null }, new Date('2026-11-23T15:00:00Z')), false)
  assert.equal(canRevealPredictionStats({ ...scheduled, startedAt: new Date() }), true)
  assert.equal(canRevealPredictionStats({ ...game, matchCondition: 'walkover' }), false)
  assert.equal(canRevealPredictionStats({ ...game, matchCondition: 'postponed' }), false)
})

test('anonymous percentages sum to 100 without inventing votes', () => {
  assert.deepEqual(predictionPercentages({ teamA: 1, draw: 1, teamB: 1 }), { teamA: 34, draw: 33, teamB: 33, total: 3 })
  assert.deepEqual(predictionPercentages({ teamA: 2, draw: 0, teamB: 1 }), { teamA: 67, draw: 0, teamB: 33, total: 3 })
  assert.equal(predictionPercentages(null).total, 0)
})

test('result correction previews pool points, shared positions, group standings and bracket changes without mutation', () => {
  const data = { games: [game, next], users, predictions }
  const copy = structuredClone(data)
  const impact = buildResultImpact(data, game.id, { placarA: 0, placarB: 1, expectedScoreRevision: 2 })
  assert.deepEqual(impact.ranking.map((row) => [row.id, row.beforePoints, row.afterPoints, row.beforePosition, row.afterPosition]), [['v', 0, 2, 2, 1], ['u', 2, 0, 1, 2]])
  assert.equal(impact.standings.find((row) => row.team === '9º B').afterPoints, 3)
  assert.equal(impact.nextMatches[0].after, '9º B')
  assert.equal(impact.blocked, false)
  assert.deepEqual(data, copy)
  assert.throws(() => buildResultImpact(data, game.id, { placarA: 0, placarB: 1, expectedScoreRevision: 1 }), /placar mudou/)
  assert.equal(buildResultImpact({ ...data, games: [game, { ...next, status: 'encerrado', liveStatus: 'live' }] }, game.id, { placarA: 0, placarB: 1 }).blocked, true)
})

test('reopening removes awarded points and dependent slots; incomplete groups do not promise qualification', () => {
  const data = { games: [game, next], users, predictions }
  const impact = buildResultImpact(data, game.id, { status: 'aberto' })
  assert.equal(impact.nextMatches[0].after, 'A definir')
  assert.equal(impact.ranking.find((row) => row.id === 'u').afterPoints, 0)
  const groupFinal = { ...next, sourceGameIdA: '', seedLabelA: '1o Grupo A', timeA: 'A definir' }
  const pending = { ...game, id: 'pending', status: 'aberto', liveStatus: 'scheduled', timeB: '8º B', placarA: null, placarB: null }
  assert.equal(buildResultImpact({ ...data, games: [game, groupFinal, pending] }, game.id, { placarA: 0, placarB: 1 }).nextMatches.length, 0)
  assert.equal(buildResultImpact({ ...data, games: [game, groupFinal] }, game.id, { placarA: 0, placarB: 1 }).nextMatches[0].after, '9º B')
})

test('report uses official results, preserves shared positions, distinguishes pending matches and avoids full athlete names', () => {
  const data = { games: [{ ...game, scorerStats: [{ playerId: 'p', side: 'A', playerName: 'João Henrique Silva', total: 2 }] }, next], teams: [], ranking: [{ ...user, pontos: 2, acertosExatos: 1 }, { ...users[1], pontos: 2, acertosExatos: 1 }], generatedAt: '2026-11-23T18:00:00Z' }
  const report = buildFinalReport(data)
  assert.equal(report.status, 'parcial')
  assert.equal(report.pending, 1)
  assert.equal(report.played, 1)
  assert.equal(report.champions[0].champion, '')
  assert.deepEqual(report.ranking.map((row) => row.position), [1, 1])
  assert.equal(report.athletes[0].rows[0].name, 'João')
  assert.equal(report.results.find((row) => row.id === 'f').score, '-')
  assert.equal(report.standings[0].rows[0].pontos, 3)
})

test('final report recognizes an official champion and marks W.O. and cancellation without a fabricated score', () => {
  const final = { ...next, status: 'finalizado', liveStatus: 'finished', placarA: 1, placarB: 0 }
  const wo = { ...game, id: 'wo', matchCondition: 'walkover', walkoverWinner: 'B', placarA: null, placarB: null }
  const cancelled = { ...game, id: 'cancelled', status: 'encerrado', matchCondition: 'cancelled' }
  const report = buildFinalReport({ games: [game, final, wo, cancelled] })
  assert.equal(report.status, 'final')
  assert.equal(report.champions[0].champion, '9º A')
  assert.equal(report.cancelled, 1)
  assert.equal(report.walkovers, 1)
  assert.match(report.results.find((row) => row.id === 'wo').situation, /W.O./)
  assert.equal(report.results.find((row) => row.id === 'wo').score, '-')
  assert.equal(report.results.find((row) => row.id === 'cancelled').score, '-')
})

test('only a completed league without a performance tie can define its champion without a knockout final', () => {
  assert.equal(buildFinalReport({ games: [game] }).champions[0].champion, '')
  assert.equal(buildFinalReport({ games: [{ ...game, stageType: 'league', groupName: 'Classificação geral' }] }).champions[0].champion, '9º A')
  const tied = { ...game, stageType: 'league', placarA: 1, placarB: 1 }
  assert.equal(buildFinalReport({ games: [tied] }).champions[0].champion, '')
  assert.match(buildFinalReport({ games: [tied] }).champions[0].situation, /Empate/)
})

test('server retries are idempotent and failures propagate for the platform retry', async () => {
  const data = { users: [user], games: [game], predictions: [predictions[0]] }
  let changed = 0, failed = false
  const store = { claim: async () => 1, readRankingData: async () => data, commit: async (_scope, _token, changes) => { changed += changes.length; for (const change of changes) Object.assign(data[change.collection === 'users' ? 'users' : 'predictions'].find((item) => item.id === change.id), change.fields); return true }, finish: async () => true, fail: async () => { failed = true } }
  await processRanking(store, 'first')
  assert.equal(changed, 2)
  changed = 0
  await processRanking(store, 'retry')
  assert.equal(changed, 0)
  await assert.rejects(processRanking({ ...store, readRankingData: async () => { throw new Error('network') } }, 'error'), /network/)
  assert.equal(failed, true)
})
