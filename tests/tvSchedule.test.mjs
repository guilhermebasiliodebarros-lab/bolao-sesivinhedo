import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTVSchedule, eventDate, nextSchoolDay, schoolDay } from '../src/utils/tvSchedule.js'
import { normalizePlayerInput } from '../src/utils/player.js'

const make = (id, sport, dataHora = '2026-11-06T12:00', extra = {}) => ({ id, sportId: sport, esporteNome: sport, timeA: 'Turma A', timeB: 'Turma B', status: 'aberto', dataHora, ...extra })

test('school-local dates and tomorrow are independent of the browser timezone', () => {
  assert.equal(schoolDay('2026-11-07T01:30:00Z'), '2026-11-06')
  assert.equal(schoolDay('2026-11-07T03:30:00Z'), '2026-11-07')
  assert.equal(schoolDay('2026-11-06T23:59'), '2026-11-06')
  assert.equal(eventDate('2026-11-06T23:59').toISOString(), '2026-11-07T02:59:00.000Z')
  assert.equal(nextSchoolDay('2026-12-31'), '2027-01-01')
})

test('today, tomorrow, later days and overdue matches are separate pages', () => {
  const games = [make('today', 'Futebol'), make('tomorrow', 'Vôlei', '2026-11-07T10:00'), make('later', 'Xadrez', '2026-11-09T10:00'), make('past', 'Basquete', '2026-11-05T10:00'), make('unknown', 'Handebol', '')]
  const schedule = buildTVSchedule(games, { day: '2026-11-06' })
  for (const [id, kind] of [['today', 'today'], ['tomorrow', 'tomorrow'], ['later', 'future'], ['past', 'waiting'], ['unknown', 'undated']]) {
    assert(schedule.pages.some((page) => page.kind === kind && page.games.some((game) => game.id === id)))
  }
  assert.equal(schedule.counts.live, 0)
})

test('large schedules cover every sport and match without starving simultaneous live games', () => {
  const sports = ['Futebol', 'Vôlei', 'Xadrez', 'Handebol', 'Basquete']
  const games = sports.flatMap((sport, sportIndex) => Array.from({ length: sportIndex ? 8 : 25 }, (_, index) => make(`${sport}-${index}`, sport)))
  games.push(...sports.map((sport, index) => make(`live-${index}`, sport, '2026-11-06T09:00', { status: 'encerrado', liveStatus: 'live' })))
  games.push(make('tomorrow', 'Vôlei', '2026-11-07T10:00'), make('result', 'Xadrez', '2026-11-06T09:00', { status: 'finalizado', placarA: 1, placarB: 0 }))
  const { pages } = buildTVSchedule(games, { day: '2026-11-06' })
  assert.equal(new Set(pages.map((page) => page.id)).size, pages.length)
  assert.deepEqual(new Set(pages.flatMap((page) => page.games.map((game) => game.id))), new Set(games.map((game) => game.id)))
  let consecutiveAgenda = 0
  for (const page of pages) {
    assert(page.games.length <= (page.kind === 'live' ? 4 : 6))
    consecutiveAgenda = page.kind === 'live' ? 0 : consecutiveAgenda + 1
    assert(consecutiveAgenda <= 2)
  }
  const firstSportPages = pages.filter((page) => page.kind === 'today').slice(0, 5)
  assert.equal(new Set(firstSportPages.map((page) => page.sportName)).size, 5)
})

test('all live games are shown even when there is no other programming', () => {
  const games = Array.from({ length: 11 }, (_, index) => make(String(index), 'Futebol', '2026-11-06T10:00', { status: 'encerrado', liveStatus: 'live' }))
  const { pages } = buildTVSchedule(games, { day: '2026-11-06' })
  assert.equal(pages.length, 3)
  assert.equal(new Set(pages.flatMap((page) => page.games.map((game) => game.id))).size, 11)
})

test('sport filters apply to every category and empty schedules stay empty', () => {
  const schedule = buildTVSchedule([make('f', 'Futebol'), make('v', 'Vôlei', '2026-11-07T10:00')], { day: '2026-11-06', sport: 'Vôlei' })
  assert.equal(schedule.counts.today, 0)
  assert.equal(schedule.counts.tomorrow, 1)
  assert(schedule.pages.every((page) => page.games.every((game) => game.sportId === 'Vôlei')))
  assert.deepEqual(buildTVSchedule([], { day: '2026-11-06' }).pages, [])
})

test('compact TV pages show two live games at a time while retaining all simultaneous matches', () => {
  const games = Array.from({ length: 7 }, (_, index) => make(`live-${index}`, index % 2 ? 'Vôlei' : 'Basquete', '2026-11-06T10:00', { status: 'encerrado', liveStatus: 'live' }))
  const schedule = buildTVSchedule(games, { day: '2026-11-06', livePageSize: 2 })
  assert.equal(schedule.pages.length, 4)
  assert.equal(schedule.counts.live, 7)
  assert(schedule.pages.every((page) => page.games.length <= 2))
  assert.deepEqual(new Set(schedule.pages.flatMap((page) => page.games.map((game) => game.id))), new Set(games.map((game) => game.id)))
})

test('player registration keeps names, positions and captains without shirt numbers', () => {
  assert.deepEqual(normalizePlayerInput({ nome: '  Ana   Silva ', posicao: ' Levantadora ', capitao: true }), { nome: 'Ana Silva', posicao: 'Levantadora', capitao: true })
  assert.equal(normalizePlayerInput({ nome: 'Aluno de xadrez' }).posicao, '')
  assert.equal('numero' in normalizePlayerInput({ nome: 'Aluno', numero: '07' }), false)
  assert.throws(() => normalizePlayerInput({ nome: ' ' }), /nome/)
})
