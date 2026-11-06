import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferSchoolShift, getTeamShift, getGameShift, resolveCompetitionShifts, validateTeamShift, validateGameShift } from '../src/utils/schoolShifts.js'
import { buildTVSchedule } from '../src/utils/tvSchedule.js'
import { buildAthleteStatistics } from '../src/utils/athleteStatistics.js'
import { buildInterclassStandings } from '../src/utils/interclassStandings.js'

test('school years assign eight morning classes and six afternoon classes, without using scheduled time', () => {
  const morning = ['9ºA', '9º B', '1ºA', '1ºB', '2ºA', '2ºB', '3ºA', '3ºB']
  const afternoon = ['6ºA', '6ºB', '7ºA', '7ºB', '8ºA', '8ºB']
  morning.forEach((name) => assert.equal(inferSchoolShift(name), 'manha'))
  afternoon.forEach((name) => assert.equal(inferSchoolShift(name), 'tarde'))
  assert.equal(inferSchoolShift('Turma 7o A'), 'tarde')
  assert.equal(inferSchoolShift('1ª série B'), 'manha')
  assert.equal(inferSchoolShift('Azul'), '')
  assert.equal(inferSchoolShift('1o Grupo A'), '')
  assert.equal(getGameShift({ timeA: '6ºA', timeB: '6ºB', dataHora: '2026-11-30T07:00' }), 'tarde')
  assert.equal(getTeamShift({ nome: 'Azul', turno: 'tarde' }), 'tarde')
})

test('known teams and an existing morning tournament keep their identity without creating afternoon registrations', () => {
  const teams = ['9ºA', '9ºB', '1ºA', '1ºB', '2ºA', '2ºB', '3ºA', '3ºB'].map((nome) => ({ nome }))
  assert.equal(teams.filter((team) => getTeamShift(team) === 'manha').length, 8)
  assert.equal(teams.filter((team) => getTeamShift(team) === 'tarde').length, 0)
  const games = resolveCompetitionShifts([{ id: 'group', sportId: 'fut', tournamentId: 'cup', timeA: '9ºA', timeB: '1ºB' }, { id: 'semi', sportId: 'fut', tournamentId: 'cup', timeA: '1o Grupo A', timeB: '2o Grupo B', seedLabelA: '1o Grupo A', seedLabelB: '2o Grupo B' }, { id: 'final', sportId: 'fut', tournamentId: 'cup', timeA: 'Vencedor semifinal 1', timeB: 'Vencedor semifinal 2' }])
  assert(games.every((game) => game.turno === 'manha'))
})

test('cross-shift teams and incorrect class registration are rejected, including generic team names', () => {
  assert.throws(() => validateTeamShift({ nome: '6ºA', turno: 'manha' }), /pertence ao turno/)
  assert.throws(() => validateTeamShift({ nome: '6ºA', turma: '9ºA', turno: 'manha' }), /turnos diferentes/)
  assert.throws(() => validateGameShift({ turno: 'manha', timeA: '9ºA', timeB: '6ºA' }), /não podem disputar/)
  assert.throws(() => validateGameShift({ sportId: 'fut', turno: 'manha', timeA: 'Azul', timeB: 'Vermelho', teamIdA: 'a', teamIdB: 'b' }, [{ id: 'a', turno: 'manha' }, { id: 'b', turno: 'tarde' }]), /não podem disputar/)
  assert.equal(validateGameShift({ turno: 'tarde', seedLabelA: '1o Grupo A', seedLabelB: '2o Grupo B' }), 'tarde')
})

test('TV, athlete rankings and group standings keep morning and afternoon apart in the same sport', () => {
  const base = { sportId: 'fut', esporteNome: 'Futebol', tournamentName: 'Interclasse', groupName: 'Grupo A', stageType: 'group', status: 'finalizado', placarA: 1, placarB: 0, dataHora: '2026-11-30T08:00', scorerStats: [{ side: 'A', playerId: 'athlete', playerName: 'Ana', total: 1 }] }
  const games = [{ ...base, id: 'morning', turno: 'manha', timeA: '9ºA', timeB: '9ºB' }, { ...base, id: 'afternoon', turno: 'tarde', timeA: '6ºA', timeB: '6ºB', dataHora: '2026-11-30T13:00' }]
  const schedule = buildTVSchedule(games, { day: '2026-11-30' })
  assert(schedule.pages.every((page) => new Set(page.games.map((game) => getGameShift(game))).size === 1))
  assert.equal(buildTVSchedule(games, { day: '2026-11-30', turno: 'tarde' }).pages[0].games[0].id, 'afternoon')
  assert.equal(buildAthleteStatistics(games).length, 2)
  assert.equal(buildAthleteStatistics(games, { turno: 'manha' }).length, 1)
  assert.equal(buildInterclassStandings(games).length, 2)
})
