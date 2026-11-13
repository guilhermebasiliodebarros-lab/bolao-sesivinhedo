import { test } from 'node:test'
import assert from 'node:assert/strict'
import { disciplineForGame, normalizeDisciplineInput, publicCardEvent, suspendedPlayers } from '../src/utils/discipline.js'
import { matchStartChecklist } from '../src/utils/matchStart.js'
import { sourceParticipant, thirdPlaceParticipants, thirdPlaceSemifinals } from '../src/utils/thirdPlace.js'
import { buildBracket, bracketParticipant } from '../src/utils/tournamentExplorer.js'

test('suspensions respect sport, shift, tournament and explicit resolution, without turning cards into suspensions', () => {
  const game = { sportId: 'football', turno: 'manha', tournamentId: 'cup' }
  const base = { sportId: 'football', turno: 'manha', status: 'active', type: 'suspension', playerId: 'ana', scope: 'modality' }
  const records = [base, { ...base, playerId: 'otherCup', scope: 'tournament', tournamentId: 'other' }, { ...base, playerId: 'otherSport', sportId: 'volley' }, { ...base, playerId: 'afternoon', turno: 'tarde' }, { ...base, playerId: 'served', status: 'served' }, { ...base, playerId: 'void', status: 'void' }, { ...base, playerId: 'yellow', type: 'yellow' }, { ...base, playerId: 'red', type: 'red' }, { ...base, playerId: 'cup', scope: 'tournament', tournamentId: 'cup' }]
  assert.deepEqual([...suspendedPlayers(records, game)], ['ana', 'cup'])
  assert.equal(disciplineForGame(records, game).length, 4)
  const check = (status) => matchStartChecklist(game, { discipline: { A: records }, attendance: { A: { players: [{ id: 'ana', status }] } } }).find((item) => item.id === 'discipline').done
  assert.equal(check('present'), false)
  assert.equal(check('absent'), true)
  assert.equal(check('pending'), true)
  assert.throws(() => normalizeDisciplineInput({ playerId: 'ana', type: 'red', reason: 'a' }), /motivo/)
})

const semi = (id, timeA, timeB, fields = {}) => ({ id, sportId: 'football', turno: 'manha', tournamentId: 'cup', stageType: 'knockout', fase: 'Semifinal', rodada: `Semifinal ${id}`, timeA, timeB, teamIdA: `${id}-a`, teamIdB: `${id}-b`, ...fields })

test('public cards use the match clock or an explicit minute and exclude private disciplinary details', () => {
  const now = new Date('2026-11-13T14:00:00Z')
  const game = semi('g', '9A', '9B', { status: 'encerrado', liveStatus: 'live', clock: { elapsedMs: 305000, runningSince: null } })
  const input = { id: 'card', type: 'yellow', teamId: 'g-a', playerName: 'Ana Beatriz Silva', reason: 'Private decision', createdBy: 'private', minute: null }
  assert.deepEqual(publicCardEvent(game, input, now), { id: 'card', kind: 'yellow', side: 'A', playerName: 'Ana', elapsedMs: 305000, recordedAt: now.getTime() })
  assert.equal(publicCardEvent(game, { ...input, minute: 12 }, now).elapsedMs, 720000)
  assert.equal(publicCardEvent({ ...game, status: 'finalizado' }, input, now).elapsedMs, null)
  assert.equal(publicCardEvent(game, { ...input, type: 'suspension' }, now), null)
  assert.throws(() => publicCardEvent(game, { ...input, teamId: 'other' }, now), /equipe/)
  for (const minute of ['abc', '-1', '1.5', '1000']) assert.throws(() => normalizeDisciplineInput({ playerId: 'ana', type: 'red', reason: 'Infração', minute }), /minuto/)
})

test('third place follows the losing side including penalties and walkovers, and unresolved or cancelled matches stay as seeds', () => {
  const a = semi('1', 'A', 'B', { status: 'finalizado', placarA: 1, placarB: 1, tieBreak: { method: 'penalties', scoreA: 4, scoreB: 5 } })
  const b = semi('2', 'C', 'D', { status: 'finalizado', matchCondition: 'walkover', walkoverWinner: 'A' })
  const draft = thirdPlaceParticipants([a, b])
  assert.equal(draft.timeA, 'A')
  assert.equal(draft.teamIdA, '1-a')
  assert.equal(draft.timeB, 'D')
  assert.equal(sourceParticipant(a).name, 'B')
  assert.equal(sourceParticipant({ ...a, tieBreak: null }), null)
  assert.equal(sourceParticipant({ ...a, matchCondition: 'cancelled' }), null)
  const pending = thirdPlaceParticipants([{ ...a, status: 'aberto' }, b])
  assert.match(pending.seedLabelA, /Perdedor/)
  assert.equal(pending.seedLabelB, '')
  assert.equal(thirdPlaceSemifinals([a, b]).length, 2)
  assert.equal(thirdPlaceSemifinals([a, b, { ...draft, id: 'bronze' }]).length, 0)
  assert.equal(thirdPlaceSemifinals([a, { ...b, tournamentId: 'other' }]).length, 0)
  assert.equal(thirdPlaceSemifinals([a, { ...b, turno: 'tarde' }]).length, 0)
})

test('public bracket resolves losing branches separately from the champion even after the bronze match is finished', () => {
  const a = semi('1', 'A', 'B', { status: 'finalizado', placarA: 2, placarB: 0 })
  const b = semi('2', 'C', 'D', { status: 'finalizado', placarA: 0, placarB: 1 })
  const bronze = { ...a, ...thirdPlaceParticipants([a, b]), id: 'bronze', timeA: 'Perdedor Semifinal 1', timeB: 'Perdedor Semifinal 2', seedLabelA: 'Perdedor Semifinal 1', seedLabelB: 'Perdedor Semifinal 2', status: 'aberto' }
  const final = { ...a, id: 'final', fase: 'Final', rodada: 'Final', sourceGameIdA: '1', sourceGameIdB: '2', timeA: 'A', timeB: 'D', status: 'finalizado', placarA: 1, placarB: 2 }
  const graph = buildBracket([a, b, bronze, final])
  assert.equal(bracketParticipant(graph.byId.get('bronze'), 'A', graph), 'B')
  assert.equal(bracketParticipant(graph.byId.get('bronze'), 'B', graph), 'C')
  assert.equal(graph.champion, 'D')
  assert.equal(graph.edges.length, 4)
  assert.equal(graph.byId.get('bronze').x, graph.byId.get('final').x)
  assert.notEqual(graph.byId.get('bronze').y, graph.byId.get('final').y)
  const finished = buildBracket([a, b, { ...bronze, timeA: 'B', timeB: 'C', seedLabelA: '', seedLabelB: '', status: 'finalizado', placarA: 4, placarB: 0 }, final])
  assert.equal(finished.champion, 'D')
})
