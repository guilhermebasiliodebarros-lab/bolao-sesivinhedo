import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPendingMatches } from '../src/utils/pendingMatches.js'
import { attendanceTeamKey } from '../src/utils/attendance.js'
import { preparationKey } from '../src/utils/matchStart.js'

const now = new Date('2026-11-06T12:00:00Z') // 09:00 in São Paulo
const fixture = (id, fields = {}) => ({ id, sportId: 'football', esporteNome: 'Futebol', timeA: 'Azul', timeB: 'Branco', dataHora: '2026-11-06T10:00', status: 'aberto', durationMinutes: 30, ...fields })
function prepared(id, fields = {}) {
  const game = fixture(id, { venue: 'Quadra principal', venueArea: 'Futebol', vestA: 'Azul', vestB: 'Amarelo', ...fields })
  game.attendanceSummary = { teamKey: attendanceTeamKey(game), teamA: 'present', teamB: 'present' }
  game.preparation = { key: preparationKey(game), playerCountA: 0, playerCountB: 0 }
  return game
}

test('scheduled games have one priority and school-local overdue starts keep their preparation action', () => {
  const games = [fixture('future'), prepared('ready'), fixture('late', { dataHora: '2026-11-06T08:59' }), prepared('late-ready', { dataHora: '2026-11-06T08:00' }), fixture('undated', { dataHora: '' })]
  const entries = buildPendingMatches(games, [], now)
  assert.equal(entries.length, games.length)
  assert.equal(new Set(entries.map((entry) => entry.game.id)).size, games.length)
  const byId = Object.fromEntries(entries.map((entry) => [entry.game.id, entry]))
  assert.equal(byId.future.category, 'prepare')
  assert.equal(byId.ready.category, 'ready')
  assert.equal(byId.ready.action, 'start')
  assert.equal(byId.late.category, 'late')
  assert.equal(byId.late.action, 'prepare')
  assert.equal(byId['late-ready'].category, 'late')
  assert.equal(byId['late-ready'].action, 'start')
  assert.equal(byId.undated.category, 'prepare')
  assert.equal(entries[0].game.id, 'late-ready')
})

test('live alerts use actual start and configured duration, without inventing or ending results', () => {
  const games = [fixture('long', { liveStatus: 'live', startedAt: new Date('2026-11-06T11:00:00Z'), durationMinutes: 60 }), fixture('recent', { liveStatus: 'live', dataHora: '2026-11-05T07:00', startedAt: { toDate: () => new Date('2026-11-06T11:55:00Z') } }), fixture('legacy', { liveStatus: 'live', dataHora: '2026-11-06T08:00' })]
  const before = games.map((game) => ({ ...game }))
  const entries = buildPendingMatches(games, [], now)
  assert.deepEqual(entries.map((entry) => entry.game.id), ['legacy', 'long'])
  assert(entries.every((entry) => entry.category === 'results' && entry.action === 'score'))
  assert.deepEqual(games, before)
  assert.equal(games[0].liveStatus, 'live')
  assert.equal(games[0].placarA, undefined)
})

test('finished, cancelled and in-progress matches are excluded; postponed and unresolved slots have distinct actions', () => {
  const entries = buildPendingMatches([fixture('done', { status: 'finalizado' }), fixture('cancelled', { matchCondition: 'cancelled' }), fixture('live', { liveStatus: 'live', startedAt: now }), fixture('postponed', { matchCondition: 'postponed', conditionReason: 'Chuva' }), fixture('seed', { seedLabelA: 'Vencedor semifinal' }), fixture('repeated', { timeB: 'Azul' })], [], now)
  assert.deepEqual(entries.map((entry) => entry.game.id), ['postponed', 'repeated', 'seed'])
  assert.equal(entries[0].action, 'reschedule')
  assert.equal(entries[0].reasons[0], 'Chuva')
  assert(entries.slice(1).every((entry) => entry.category === 'teams' && entry.action === 'none'))
})

test('ready games with occupied areas cannot be started from the central; distinct areas can', () => {
  const ready = prepared('ready')
  const active = fixture('active', { timeA: 'Verde', timeB: 'Preto', liveStatus: 'live', venue: ready.venue, venueArea: ready.venueArea, startedAt: now })
  const blocked = buildPendingMatches([ready, active], [], now)[0]
  assert.equal(blocked.category, 'ready')
  assert.equal(blocked.action, 'prepare')
  assert.equal(blocked.conflicts.length, 1)
  const free = buildPendingMatches([ready, { ...active, sportId: 'volley', venueArea: 'Vôlei' }], [], now)[0]
  assert.equal(free.action, 'start')
})

test('changed rosters invalidate a saved conference and return it to preparation', () => {
  const game = prepared('ready', { teamIdA: 'teamA' })
  const entry = buildPendingMatches([game], [{ id: 'teamA', playerCount: 1 }], now)[0]
  assert.equal(entry.category, 'prepare')
  assert.equal(entry.action, 'prepare')
})
