import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalTestSession } from '../src/utils/localTestSession.js'
import { matchPeriod } from '../src/utils/matchPeriods.js'

function setup() {
  let time = new Date('2026-11-13T15:00:00Z').getTime(), serial = 0
  const session = createLocalTestSession({ now: () => new Date(time) })
  const game = (id = 'teste-futebol-1') => session.getSnapshot().games.find((item) => item.id === id)
  async function score(id, side = 'A', value = 1) {
    const current = game(id)
    const report = await session.api.loadMatchReport(current)
    const player = side === 'A' ? report.playersA[0] : report.playersB[0]
    await session.api.recordLiveEvent({ gameId: id, requestId: `score-test-${++serial}`, side, value, playerId: player.id, expectedScoreRevision: current.scoreRevision })
  }
  return { session, game, score, tick: (ms) => { time += ms } }
}

test('in-app sessions cannot accept official IDs and never share games or changes with another test session', async () => {
  const first = setup(), second = setup()
  const original = structuredClone(first.session.getSnapshot())
  await assert.rejects(first.session.api.recordLiveEvent({ gameId: 'official-game', side: 'A', value: 1, requestId: 'official-score', expectedScoreRevision: 0 }), /somente os jogos fictícios/)
  await assert.rejects(first.session.api.saveDisciplinaryRecord('official-team', { gameId: 'official-game' }), /somente os jogos fictícios/)
  assert.throws(() => first.session.advance('official-game'), /somente os jogos fictícios/)
  assert.deepEqual(first.session.getSnapshot(), original)
  await first.score('teste-futebol-1')
  assert.equal(first.game().liveScoreA, 1); assert.equal(second.game().liveScoreA, 0)
  first.session.reset()
  assert.equal(first.game().liveScoreA, 0)
  assert.equal(first.session.getSnapshot().games.length, 6)
})

test('local goals, cards, corrections and undo preserve author statistics and unrelated cards', async () => {
  const { session, game, score } = setup()
  session.advance(game().id, 7 * 60)
  await score(game().id)
  assert.deepEqual(game().scorerStats[0].minutes, [7])
  assert.equal(game().scorerStats[0].playerName, 'Ana')
  const report = await session.api.loadMatchReport(game())
  const card = await session.api.saveDisciplinaryRecord(game().teamIdB, { gameId: game().id, playerId: report.playersB[0].id, type: 'yellow', reason: 'Teste de cartão.' })
  assert.equal(game().publicCardEvents[0].playerName, 'Carla')
  await score(game().id)
  await session.api.undoLiveEvent({ gameId: game().id, eventId: game().lastScoreEventId, expectedScoreRevision: game().scoreRevision })
  assert.equal(game().liveScoreA, 1); assert.equal(game().publicCardEvents.length, 1)
  await session.api.correctLiveEvent({ gameId: game().id, eventId: game().lastScoreEventId, requestId: 'correction-local', action: 'transfer', playerId: report.playersB[0].id, expectedScoreRevision: game().scoreRevision })
  assert.equal(game().liveScoreA, 0); assert.equal(game().liveScoreB, 1)
  assert.equal(game().scorerStats[0].playerName, 'Carla')
  await session.api.resolveDisciplinaryRecord({ teamId: game().teamIdB, recordId: card, status: 'void', reason: 'Correção do teste.', expectedRevision: 1 })
  assert.equal(game().publicCardEvents.length, 0)
})

test('local clock and period controls preserve accumulated goal minutes and disallow new scores during the interval', async () => {
  const { session, game, score, tick } = setup()
  tick(425000)
  await session.api.changeMatchPeriod({ gameId: game().id, action: 'interval', expectedRevision: 0, expectedClockRevision: 0 })
  await assert.rejects(score(game().id), /próximo período/)
  tick(300000)
  await session.api.changeMatchPeriod({ gameId: game().id, action: 'next', expectedRevision: 1, expectedClockRevision: 1 })
  assert.equal(matchPeriod(game(), new Date('2026-11-13T15:12:05Z')).elapsedMs, 0)
  tick(65000)
  await score(game().id)
  assert.deepEqual(game().scorerStats[0].minutes, [8])
  assert.equal(game().period.number, 2)
})

test('two basketball games and volleyball points and sets stay independent in the local preview', async () => {
  const { session, game, score } = setup()
  for (const value of [3, 2, 1]) await score('teste-basquete-1', 'A', value)
  await score('teste-basquete-2', 'B', 2)
  assert.equal(game('teste-basquete-1').liveScoreA, 6)
  assert.equal(game('teste-basquete-2').liveScoreB, 2)
  assert.equal(game('teste-basquete-1').liveScoreB, 0)
  for (let i = 0; i < 25; i++) await score('teste-volei-1')
  for (let i = 0; i < 23; i++) await score('teste-volei-1', 'B')
  const current = game('teste-volei-1')
  await session.api.recordLiveEvent({ gameId: current.id, requestId: 'end-test-set', kind: 'set', expectedScoreRevision: current.scoreRevision })
  assert.equal(game(current.id).liveScoreA, 1)
  assert.deepEqual(game(current.id).setScores, [{ a: 25, b: 23 }])
  assert.deepEqual(game(current.id).currentSet, { a: 0, b: 0 })
  assert.equal(game('teste-volei-2').liveScoreA, 0)
})

test('local presence removes absent goal authors and finalizing a fixture never affects another match', async () => {
  const { session, game, score } = setup()
  const report = await session.api.loadMatchReport(game())
  const sides = Object.fromEntries(['A', 'B'].map((side) => [side, { status: 'present', players: Object.fromEntries(report.attendance[side].players.map((player) => [player.id, side === 'A' ? 'absent' : 'present'])) }]))
  await session.api.saveMatchAttendance({ gameId: game().id, expectedTeamKey: report.attendance.teamKey, sides })
  await assert.rejects(score(game().id), /presente/)
  await score(game().id, 'B')
  await session.api.finalizeGame({ gameId: game().id, placarA: 0, placarB: 1, expectedScoreRevision: game().scoreRevision })
  assert.equal(game().status, 'finalizado'); assert.equal(game().clock.runningSince, null)
  assert.equal(game('teste-handebol-1').status, 'encerrado')
  await assert.rejects(score(game().id, 'B'), /encerrado/)
})
