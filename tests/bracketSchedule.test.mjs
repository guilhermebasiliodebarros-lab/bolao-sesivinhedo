import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bracketScheduleConflicts, planBracketSchedule } from '../src/utils/bracketSchedule.js'
import { eventDate, schoolDay } from '../src/utils/tvSchedule.js'
import { findScheduleConflicts } from '../src/utils/scheduleConflicts.js'

const options = { dataInicial: '2099-11-30T08:00', durationMinutes: 30, intervaloMinutos: 30, descansoMinutos: 10, limiteHorasAntes: 1 }
const match = (id, a, b, extra = {}) => ({ id, sportId: 'f', turno: 'manha', tournamentId: 'new', timeA: a, timeB: b, stageType: 'group', groupName: 'Grupo A', durationMinutes: 30, dataHora: options.dataInicial, status: 'aberto', ...extra })
const minutes = (value) => eventDate(value).getTime() / 60000

test('different sport registrations of the same class cannot overlap, including compact and middle-school names', () => {
  const existing = [match('v', '9A', '1º EM B', { sportId: 'v', tournamentId: 'volley' })]
  const draft = [match('f', '9º A', '9º B')]
  const copy = structuredClone({ existing, draft })
  const plan = planBracketSchedule(draft, existing, [], options)
  assert.equal(plan.error, '')
  assert.equal(plan.games[0].dataHora, '2099-11-30T08:40')
  assert.equal(minutes(plan.games[0].dataHora) - minutes(plan.games[0].limitePalpites), 5)
  assert.equal(bracketScheduleConflicts(plan.games, existing, [], 10).length, 0)
  assert.deepEqual({ existing, draft }, copy)
  const secondary = planBracketSchedule([match('f', '1º B', '2º A')], existing, [], options)
  assert.equal(secondary.games[0].dataHora, '2099-11-30T08:40')
  assert.equal(findScheduleConflicts(draft[0], existing).length, 1)
})

test('uses free classes first and keeps a match inside a free gap before a later reservation', () => {
  const existing = [match('long', '9º A', '1º A', { sportId: 'v', durationMinutes: 60 }), match('late', '2º A', '2º B', { sportId: 'b', dataHora: '2099-11-30T09:00' })]
  const plan = planBracketSchedule([match('a', '9º A', '9º B'), match('b', '2º A', '3º A')], existing, [], options)
  assert.equal(plan.error, '')
  assert.equal(plan.games[0].id, 'b')
  assert.equal(plan.games[0].dataHora, '2099-11-30T08:00')
  assert.equal(plan.games[1].dataHora, '2099-11-30T09:10')
  assert.equal(bracketScheduleConflicts(plan.games, existing, [], 10).length, 0)
})

test('explicit class metadata links differently named squads, while generic names in different sports remain independent', () => {
  const teams = [{ id: 'f-a', sportId: 'f', nome: 'Falcões', turma: '9º A' }, { id: 'v-a', sportId: 'v', nome: 'Verde', turma: '9A' }]
  const draft = [match('a', 'Falcões', 'Azul', { teamIdA: 'f-a' })]
  const existing = [match('other', 'Verde', 'Vermelho', { sportId: 'v', teamIdA: 'v-a' })]
  assert.equal(planBracketSchedule(draft, existing, teams, options).games[0].dataHora, '2099-11-30T08:40')
  assert.equal(planBracketSchedule([match('a', 'Azul', 'Branco')], [match('v', 'Azul', 'Branco', { sportId: 'v' })], [], options).games[0].dataHora, options.dataInicial)
})

test('venue areas allow simultaneous independent sports, while a blank area reserves the whole venue', () => {
  const draft = [match('a', '9º A', '9º B', { venue: 'Quadra', venueArea: 'Futebol' })]
  const other = match('b', '2º A', '2º B', { sportId: 'v', venue: 'quadra', venueArea: 'Vôlei' })
  assert.equal(planBracketSchedule(draft, [other], [], options).games[0].dataHora, options.dataInicial)
  assert.equal(planBracketSchedule(draft, [{ ...other, venueArea: '' }], [], options).games[0].dataHora, '2099-11-30T08:30')
})

test('overlapping minutes count even when starts differ; duration sets the minimum cadence and rest applies before and after reservations', () => {
  const plan = planBracketSchedule([match('a', '9º A', '9º B'), match('b', '9º A', '1º A')], [match('other', '9º A', '2º A', { sportId: 'v', dataHora: '2099-11-30T08:35' })], [], { ...options, intervaloMinutos: 5 })
  assert.equal(plan.games[0].dataHora, '2099-11-30T09:15')
  assert.equal(plan.games[1].dataHora, '2099-11-30T09:55')
  const separate = planBracketSchedule([match('a', '9º A', '9º B'), match('b', '2º A', '2º B')], [], [], { ...options, intervaloMinutos: 0 })
  assert.equal(minutes(separate.games[1].dataHora) - minutes(separate.games[0].dataHora), 30)
})

test('cancelled, postponed, finished and undated fixtures do not reserve slots, while scheduled and live games do', () => {
  const statuses = [{ status: 'finalizado' }, { matchCondition: 'cancelled' }, { matchCondition: 'postponed' }, { dataHora: '' }]
  for (const fields of statuses) assert.equal(planBracketSchedule([match('a', '9º A', '9º B')], [match('v', '9º A', '1º A', { sportId: 'v', ...fields })], [], options).games[0].dataHora, options.dataInicial)
  assert.equal(planBracketSchedule([match('a', '9º A', '9º B')], [match('v', '9º A', '1º A', { sportId: 'v', status: 'encerrado', liveStatus: 'live' })], [], options).games[0].dataHora, '2099-11-30T08:40')
})

test('daily closing time rolls to the next calendar day at the school-local opening time', () => {
  const plan = planBracketSchedule([match('a', '9º A', '9º B'), match('b', '9º A', '1º A'), match('c', '9º A', '2º A')], [], [], { ...options, horarioFinal: '09:00' })
  assert.equal(plan.error, '')
  assert.deepEqual(plan.games.map((game) => game.dataHora), ['2099-11-30T08:00', '2099-12-01T08:00', '2099-12-02T08:00'])
  assert.equal(plan.days, 3)
  assert.equal(schoolDay(plan.games[0].dataHora), '2099-11-30')
  const minuteEnd = planBracketSchedule([match('a', '9º A', '9º B')], [match('v', '9º A', '1º A', { sportId: 'v', dataHora: '2099-11-30T11:00:20Z' })], [], options)
  assert.equal(minuteEnd.games[0].dataHora, '2099-11-30T08:41')
})

test('unknown group qualifiers reserve only their possible classes, and knockout phases wait for their dependencies', () => {
  const groups = [match('ga', '9º A', '9º B'), match('gb', '2º A', '2º B', { groupName: 'Grupo B' })]
  const semi = match('semi', '1o Grupo A', '1o Grupo B', { stageType: 'knockout', groupName: '', seedLabelA: '1o Grupo A', seedLabelB: '1o Grupo B', fase: 'Semifinal' })
  const final = match('final', 'Vencedor Semifinal', 'Classificado', { stageType: 'knockout', groupName: '', sourceGameIdA: 'semi', seedLabelA: 'Vencedor Semifinal', seedLabelB: 'Classificado', fase: 'Final' })
  const external = [match('other-sport', '9º A', '3º A', { sportId: 'v', tournamentId: 'volley', dataHora: '2099-11-30T09:10' })]
  const plan = planBracketSchedule([final, semi, ...groups], external, [], options)
  assert.equal(plan.error, '')
  assert.equal(plan.games.at(-1).id, 'final')
  const scheduledSemi = plan.games.find((game) => game.id === 'semi')
  assert.ok(minutes(scheduledSemi.dataHora) >= minutes('2099-11-30T09:50'))
  assert.equal(bracketScheduleConflicts(plan.games, external, [], 10).length, 0)
  assert.ok(bracketScheduleConflicts([{ ...semi, dataHora: options.dataInicial }, ...groups], external, [], 10).some((issue) => issue.reasons.some((reason) => reason.includes('Fase anterior'))))
})

test('invalid settings and cyclic draft references surface an error, while unrelated broken old brackets do not block planning', () => {
  const draft = [match('a', '9º A', '9º B')]
  for (const fields of [{ durationMinutes: '' }, { durationMinutes: 0 }, { descansoMinutos: -1 }, { descansoMinutos: 1.5 }, { intervaloMinutos: -2 }, { horarioFinal: '07:00' }, { horarioFinal: '08:20' }]) assert.notEqual(planBracketSchedule(draft, [], [], { ...options, ...fields }).error, '')
  const circular = [match('a', 'Vencedor B', '9º B', { sourceGameIdA: 'b' }), match('b', 'Vencedor A', '1º B', { sourceGameIdA: 'a' })]
  assert.match(planBracketSchedule(circular, [], [], options).error, /circular/)
  const old = match('old', 'Vencedor removido', '9º B', { sportId: 'v', tournamentId: 'old', sourceGameIdA: 'deleted', dataHora: '2090-01-01T08:00' })
  assert.equal(planBracketSchedule(draft, [old], [], options).error, '')
  assert.equal(planBracketSchedule(draft, [], [], { ...options, dataInicial: '' }).error, '')
})

test('when a winner is known, a later round does not reserve an eliminated class from the other side of its source', () => {
  const parent = match('semi', '9º A', '9º B', { stageType: 'knockout', groupName: '', fase: 'Semifinal', dataHora: '2099-11-30T07:00', status: 'finalizado', placarA: 2, placarB: 0 })
  const final = match('final', 'Vencedor Semifinal', '2º A', { stageType: 'knockout', groupName: '', fase: 'Final', sourceGameIdA: 'semi', seedLabelA: 'Vencedor Semifinal' })
  const otherSport = match('other', '9º B', '3º A', { sportId: 'v', tournamentId: 'volley' })
  const plan = planBracketSchedule([final], [parent, otherSport], [], options)
  assert.equal(plan.error, '')
  assert.equal(plan.games[0].dataHora, options.dataInicial)
  assert.equal(bracketScheduleConflicts(plan.games, [parent, otherSport], [], 10).length, 0)
})

test('successive modalities share one class calendar without mutating games already created', () => {
  let existing = []
  const rooms = ['9º A', '9º B', '1º A', '1º B', '2º A', '2º B', '3º A', '3º B']
  for (let sport = 0; sport < 8; sport++) {
    const drafts = rooms.flatMap((a, index) => rooms.slice(index + 1).map((b) => match(`s${sport}-${index}-${b}`, a, b, { sportId: `s${sport}`, tournamentId: `cup${sport}` })))
    const snapshot = structuredClone(existing)
    const plan = planBracketSchedule(drafts, existing, [], { ...options, durationMinutes: 12, intervaloMinutos: 12, descansoMinutos: 5, horarioFinal: '12:00' })
    assert.equal(plan.error, '')
    assert.equal(bracketScheduleConflicts(plan.games, existing, [], 5).length, 0)
    assert.equal(new Set(plan.games.map((game) => game.id)).size, drafts.length)
    assert.deepEqual(existing, snapshot)
    existing = [...existing, ...plan.games]
  }
})
