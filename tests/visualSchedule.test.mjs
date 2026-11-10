import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarCandidate, calendarColumns, calendarConflicts, calendarConflictSignature, calendarFingerprint, calendarSlotGames, calendarSlots, canScheduleGame } from '../src/utils/visualSchedule.js'
import { deletionSelection, validateDeletionSelection } from '../src/utils/bulkGameDeletion.js'

const game = { id: 'a', sportId: 'football', turno: 'manha', timeA: '9º A', timeB: '9º B', dataHora: '2099-11-10T09:00', durationMinutes: 45, status: 'aberto', venue: 'Quadra 1', venueArea: 'Futebol' }

test('the visual calendar uses real duration, class identities across sports and physical areas for conflicts', () => {
  const others = [{ ...game, id: 'b', sportId: 'volley', timeA: '9A', timeB: '1A', venue: 'Quadra 2', dataHora: '2099-11-10T09:30' }, { ...game, id: 'c', timeA: '2º A', timeB: '3º B', venueArea: 'Vôlei' }]
  const conflicts = calendarConflicts(game, others, [])
  assert.equal(conflicts.length, 1)
  assert.match(conflicts[0].reasons.join(), /turma/)
  assert.equal(calendarConflicts({ ...game, dataHora: '2099-11-10T08:45' }, others.slice(0, 1), []).length, 0)
  assert.notEqual(calendarConflictSignature(conflicts), calendarConflictSignature(calendarConflicts(game, [{ ...others[0], dataHora: '2099-11-10T09:35' }], [])))
  assert.equal(calendarConflicts({ ...game, sourceGameIdA: 'missing' }, [], [])[0].reasons[0], 'Fase anterior sem horário ou ainda em andamento')
})

test('calendar placement keeps metadata and rejects live, finished, started, cancelled or deleting matches and invalid inputs', () => {
  const candidate = calendarCandidate(game, { dataHora: '2099-11-10T10:00', durationMinutes: '30', venue: ' Quadra 2 ', venueArea: ' ' })
  assert.equal(candidate.venue, 'Quadra 2')
  assert.equal(candidate.timeA, game.timeA)
  assert.equal(candidate.status, game.status)
  assert.notEqual(calendarFingerprint(game), calendarFingerprint(candidate))
  for (const fields of [{ liveStatus: 'live' }, { status: 'finalizado' }, { startedAt: '2099-11-10T09:00' }, { matchCondition: 'cancelled' }, { matchCondition: 'postponed' }, { deletionPending: 'operation' }]) assert.equal(canScheduleGame({ ...game, ...fields }), false)
  for (const fields of [{ dataHora: '' }, { durationMinutes: 0 }, { durationMinutes: 3.5 }]) assert.throws(() => calendarCandidate(game, { ...candidate, ...fields }))
})

test('the grid groups school-local instants into the right slots and venues, while outside hours remain detectable', () => {
  assert.deepEqual(calendarSlots('09:00', '10:00', 30), ['09:00', '09:30'])
  assert.deepEqual(calendarSlots('10:00', '09:00', 30), [])
  assert.deepEqual(calendarColumns([game, { ...game, venue: 'quadra 1' }], ['Quadra 2']), ['', 'quadra 1', 'Quadra 2'])
  assert.equal(calendarSlotGames([{ ...game, dataHora: '2099-11-10T12:15:00Z' }], '2099-11-10', '09:00', 30, 'Quadra 1').length, 1)
  assert.equal(calendarSlotGames([game], '2099-11-11', '09:00', 30, 'Quadra 1').length, 0)
})

test('bulk deletion scopes are explicit and cannot leave dependent matches outside the selection', () => {
  const games = [game, { ...game, id: 'b', sportId: 'volley', tournamentId: 'cup' }, { ...game, id: 'c', turno: 'tarde', timeA: '6º A', timeB: '6º B', tournamentId: 'cup-2' }]
  assert.equal(deletionSelection(games, {}).length, 3)
  assert.deepEqual(deletionSelection(games, { sportId: 'volley', turno: 'manha' }).map((item) => item.id), ['b'])
  assert.deepEqual(deletionSelection(games, { tournamentId: 'cup-2' }).map((item) => item.id), ['c'])
  assert.throws(() => validateDeletionSelection([game], [...games, { ...game, id: 'final', sourceGameIdA: game.id }]), /torneio completo/)
  assert.throws(() => validateDeletionSelection([{ ...game, liveStatus: 'live' }], games), /ao vivo/)
  assert.equal(validateDeletionSelection(games, games).size, 3)
})
