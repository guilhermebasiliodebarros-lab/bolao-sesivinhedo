import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatMatchClock, matchClockValue, stoppedMatchClock } from '../src/utils/matchClock.js'
import { dailySchedule, scheduleRow } from '../src/utils/dailySchedule.js'
import { normalizeRegulation } from '../src/utils/regulations.js'
import { buildPendingMatches } from '../src/utils/pendingMatches.js'

const live = { id: 'live', status: 'encerrado', liveStatus: 'live', timeA: 'Azul', timeB: 'Branco', durationMinutes: 30, startedAt: '2026-11-06T10:00' }
const at = (time) => new Date(`2026-11-06T${time}-03:00`)
test('clock counts actual play, freezes on pause, resumes across reloads and goes beyond the expected duration', () => {
  assert.equal(matchClockValue(live, at('10:05')).elapsedMs, 300000)
  const paused = { ...live, clock: stoppedMatchClock(live, at('10:05')) }
  assert.deepEqual(matchClockValue(paused, at('11:00')), { elapsedMs: 300000, running: false, exceeded: false })
  const resumed = { ...paused, clock: { ...paused.clock, runningSince: at('11:00') } }
  assert.equal(matchClockValue(resumed, at('11:10')).elapsedMs, 900000)
  assert.equal(matchClockValue(resumed, at('11:25')).exceeded, true)
  assert.equal(formatMatchClock(6000500), '100:00')
  assert.equal(formatMatchClock(-300), '00:00')
  assert.equal(matchClockValue(resumed, at('10:59')).elapsedMs, 300000)
  assert.equal(live.liveStatus, 'live')
})
test('central uses playing time instead of counting a long pause as an overdue result', () => {
  const paused = { ...live, clock: { elapsedMs: 5000, runningSince: null, revision: 2 } }
  assert.equal(buildPendingMatches([paused], [], at('14:00')).length, 0)
  assert.equal(buildPendingMatches([{ ...paused, clock: { ...paused.clock, elapsedMs: 1800000 } }], [], at('14:00'))[0].category, 'results')
})
test('daily schedule keeps simultaneous games, school date, deterministic order and optional cancellations', () => {
  const base = { status: 'aberto', esporteNome: 'Vôlei', sportId: 'volley', timeA: 'A', timeB: 'B', venue: 'Quadra' }
  const games = [{ ...base, id: 'later', dataHora: '2026-11-07T00:10' }, { ...base, id: 'cancel', dataHora: '2026-11-06T09:00', matchCondition: 'cancelled' }, { ...base, id: 'volley', dataHora: '2026-11-06T23:50' }, { ...base, id: 'basket', esporteNome: 'Basquete', sportId: 'basket', dataHora: '2026-11-07T02:50:00Z' }, { ...base, id: 'undated', dataHora: '' }]
  assert.deepEqual(dailySchedule(games, { day: '2026-11-06' }).map((game) => game.id), ['cancel', 'basket', 'volley'])
  assert.deepEqual(dailySchedule(games, { day: '2026-11-06', sport: 'volley', venue: 'Quadra', includeCancelled: false }).map((game) => game.id), ['volley'])
  assert.equal(dailySchedule(games, { day: '2026-11-06', venue: 'Sala' }).length, 0)
  assert.match(scheduleRow(games[1])[6], /Cancelado/)
  assert.doesNotMatch(scheduleRow(games[0])[6], /0 × 0/)
  assert.match(scheduleRow({ ...live, liveScoreA: 2, liveScoreB: 1 })[6], /2 × 1 \(parcial\)/)
  assert.match(scheduleRow({ ...live, status: 'finalizado', placarA: null, placarB: null })[6], /Resultado final/)
  assert.doesNotMatch(scheduleRow({ ...live, status: 'finalizado', placarA: null, placarB: null })[6], /0 × 0/)
})
test('regulations start blank and keep only the text entered by the organization within section limits', () => {
  assert.deepEqual(normalizeRegulation(), { participation: '', classification: '', tieBreak: '', walkover: '', notes: '' })
  const notes = normalizeRegulation({ walkover: '  Tolerância definida pela escola.  ', ignored: 'secret' })
  assert.equal(notes.walkover, 'Tolerância definida pela escola.')
  assert.equal(notes.participation, '')
  assert.equal(notes.ignored, undefined)
  assert.equal(normalizeRegulation({ notes: 'a'.repeat(10000) }).notes.length, 10000)
  assert.throws(() => normalizeRegulation({ notes: 'a'.repeat(10001) }), /10.000/)
})
