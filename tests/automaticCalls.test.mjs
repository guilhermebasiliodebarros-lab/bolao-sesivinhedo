import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAutomaticCalls, normalizeBroadcastSettings } from '../src/utils/automaticCalls.js'
import { normalizeTieBreak, canUseTieBreak } from '../src/utils/tieBreak.js'
import { matchStartChecklist } from '../src/utils/matchStart.js'
import { attendanceTeamKey } from '../src/utils/attendance.js'
import { venuesOverlap } from '../src/utils/matchVenue.js'

const base = { id: 'one', timeA: '8º A', timeB: '8º B', esporteNome: 'Futebol', venue: 'Quadra 1', status: 'aberto', dataHora: '2026-11-06T10:00' }
test('automatic calls enter the lead window, show school time and disappear at kickoff', () => {
  assert.equal(buildAutomaticCalls([base], {}, new Date('2026-11-06T12:49:59Z')).length, 0)
  const calls = buildAutomaticCalls([base], {}, new Date('2026-11-06T12:50:00Z'))
  assert.equal(calls.length, 1)
  assert.match(calls[0].text, /8º A e 8º B/)
  assert.match(calls[0].text, /Quadra 1, às 10:00/)
  assert.match(calls[0].text, /10 minuto/)
  assert.equal(buildAutomaticCalls([base], {}, new Date('2026-11-06T13:00:00Z')).length, 0)
  assert.equal(buildAutomaticCalls([base], { autoCallsEnabled: false }, new Date('2026-11-06T12:55:00Z')).length, 0)
  assert.equal(normalizeBroadcastSettings({}).leadMinutes, 10)
})
test('automatic calls omit started, postponed, cancelled, finished and unresolved games', () => {
  const games = [base, { ...base, id: 'live', liveStatus: 'live' }, { ...base, id: 'postponed', matchCondition: 'postponed' }, { ...base, id: 'cancelled', matchCondition: 'cancelled' }, { ...base, id: 'finished', status: 'finalizado' }, { ...base, id: 'seed', seedLabelA: 'Vencedor 1' }, { ...base, id: 'date', dataHora: '' }]
  assert.deepEqual(buildAutomaticCalls(games, {}, new Date('2026-11-06T12:55:00Z')).map((call) => call.gameId), ['one'])
})
test('simultaneous calls retain every match and reflect reschedules and venue edits', () => {
  const now = new Date('2026-11-06T12:55:00Z')
  const calls = buildAutomaticCalls([base, { ...base, id: 'two', venue: 'Quadra 2', esporteNome: 'Vôlei', dataHora: '2026-11-06T10:02' }], {}, now)
  assert.equal(calls.length, 2)
  assert.match(calls[1].text, /Vôlei em Quadra 2/)
  assert.equal(buildAutomaticCalls([{ ...base, dataHora: '2026-11-07T10:00' }], {}, now).length, 0)
})
test('tie breakers are limited to knockout games and reset when normal time has a winner', () => {
  const game = { esporteNome: 'Futebol', stageType: 'knockout' }
  assert.equal(canUseTieBreak({ ...game, stageType: 'group' }), false)
  assert.equal(canUseTieBreak({ ...game, esporteNome: 'Vôlei' }), false)
  assert.deepEqual(normalizeTieBreak(game, { method: 'penalties', scoreA: '4', scoreB: '3' }, 1, 1, { final: true }), { method: 'penalties', scoreA: 4, scoreB: 3 })
  assert.equal(normalizeTieBreak(game, { method: 'penalties', scoreA: 4, scoreB: 3 }, 2, 1, { final: true }), null)
})

test('chess preparation requires attendance and a table but no vest colors', () => {
  const game = { ...base, esporteNome: 'Xadrez', sportId: 'chess', venue: 'Mesa de xadrez 1' }
  game.attendanceSummary = { teamKey: attendanceTeamKey(game), teamA: 'present', teamB: 'present' }
  assert(matchStartChecklist(game).every((check) => check.done))
  const active = { ...game, id: 'other', venue: 'Mesa de xadrez 2', status: 'encerrado', liveStatus: 'live' }
  assert.equal(matchStartChecklist(game, { games: [active] }).find((check) => check.id === 'conflicts').done, false)
})

test('independent areas share a venue; a blank area reserves the full venue', () => {
  assert.equal(venuesOverlap({ venue: 'Quadra principal', venueArea: 'Basquete' }, { venue: 'quadra principal', venueArea: 'Vôlei' }), false)
  assert.equal(venuesOverlap({ venue: 'Quadra principal', venueArea: 'Vôlei' }, { venue: 'quadra principal', venueArea: 'volei' }), true)
  assert.equal(venuesOverlap({ venue: 'Quadra principal' }, { venue: 'quadra principal', venueArea: 'Basquete' }), true)
})
