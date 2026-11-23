import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventOverview, filterCalendarGames, formatCalendarTime, groupCalendarDays, sortCalendarGames } from '../src/utils/calendarExplorer.js'
import { findRankingEntries } from '../src/utils/rankingPresentation.js'

const now = new Date('2026-11-17T10:00:00-03:00')
const match = (id, extra = {}) => ({ id, sportId: 'fut', esporteNome: 'Futebol', timeA: '9º A', timeB: '9º B', turno: 'manha', fase: 'Final', status: 'aberto', dataHora: '2026-11-17T11:00', venue: 'Quadra principal', venueArea: 'Área de futebol', ...extra })

test('calendar combines date, sport, shift, phase, venue and accent-insensitive search', () => {
  const games = [match('target'), match('later', { dataHora: '2026-11-18T11:00' }), match('other-venue', { venue: 'Sala 2' }), match('other-shift', { turno: 'tarde' })]
  const snapshot = structuredClone(games)
  const result = filterCalendarGames(games, { day: 'today', sport: 'fut', shift: 'manha', phase: 'Final', venue: 'Quadra principal', search: '  area de futebol  ' }, now)
  assert.deepEqual(result.map((game) => game.id), ['target'])
  assert.deepEqual(games, snapshot)
  assert.deepEqual(filterCalendarGames(games, { day: 'tomorrow' }, now).map((game) => game.id), ['later'])
})

test('live, postponed and cancelled states follow official match state, not start time', () => {
  const games = [match('past', { dataHora: '2026-11-17T08:00' }), match('live', { status: 'encerrado', liveStatus: 'live' }), match('postponed', { matchCondition: 'postponed' }), match('cancelled', { matchCondition: 'cancelled' }), match('final', { status: 'finalizado' })]
  assert.deepEqual(filterCalendarGames(games, { state: 'live' }, now).map((game) => game.id), ['live'])
  assert.deepEqual(filterCalendarGames(games, { state: 'scheduled' }, now).map((game) => game.id), ['past'])
  assert.deepEqual(filterCalendarGames(games, { state: 'postponed' }, now).map((game) => game.id), ['postponed'])
  assert.deepEqual(filterCalendarGames(games, { state: 'cancelled' }, now).map((game) => game.id), ['cancelled'])
})

test('date filters and day groups use Sao Paulo midnight, with undated matches last', () => {
  const games = [match('undated', { dataHora: '' }), match('tomorrow', { dataHora: '2026-11-18T03:30:00Z' }), match('late-today', { dataHora: '2026-11-18T02:30:00Z' }), match('earlier')]
  assert.deepEqual(filterCalendarGames(games, { day: 'today' }, now).map((game) => game.id), ['earlier', 'late-today'])
  assert.deepEqual(groupCalendarDays(games).map((group) => [group.id, group.games.map((game) => game.id)]), [
    ['2026-11-17', ['earlier', 'late-today']], ['2026-11-18', ['tomorrow']], ['undated', ['undated']],
  ])
  assert.equal(formatCalendarTime('2026-11-18T02:30:00Z'), '23:30')
  assert.equal(formatCalendarTime(''), 'A definir')
  assert.deepEqual(sortCalendarGames(games).map((game) => game.id), ['earlier', 'late-today', 'tomorrow', 'undated'])
})

test('home upcoming games include closed predictions and exclude past or changed matches', () => {
  const games = [match('past', { dataHora: '2026-11-17T09:00' }), match('next', { status: 'encerrado' }), match('live', { status: 'encerrado', liveStatus: 'live' }), match('cancelled', { matchCondition: 'cancelled' }), match('postponed', { matchCondition: 'postponed' }), match('final', { status: 'finalizado' }), match('undated', { dataHora: '' })]
  const result = eventOverview(games, now)
  assert.deepEqual(result.upcoming.map((game) => game.id), ['next'])
  assert.deepEqual(result.live.map((game) => game.id), ['live'])
  assert.equal(result.finished, 1)
  assert.equal(result.today, 5)
  assert.deepEqual(eventOverview([], now), { upcoming: [], live: [], today: 0, finished: 0 })
})

test('ranking search preserves original positions and handles accents and empty results', () => {
  const ranking = [{ id: '1', nome: 'Ana', pontos: 3 }, { id: '2', nome: 'João', pontos: 2 }, { id: '3', nome: 'Maria', pontos: 1 }]
  assert.deepEqual(findRankingEntries(ranking, '  joao '), [{ participant: ranking[1], position: 2 }])
  assert.deepEqual(findRankingEntries(ranking, 'inexistente'), [])
  assert.equal(findRankingEntries(ranking).length, 3)
  assert.deepEqual(ranking.map((person) => person.id), ['1', '2', '3'])
})
