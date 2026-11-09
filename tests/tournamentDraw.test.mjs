import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawFingerprint, drawSections, drawTeamOrder, validateDraw } from '../src/utils/tournamentDraw.js'

const teams = Array.from({ length: 8 }, (_, index) => ({ id: `team-${index}`, nome: `Turma ${index}`, sportId: 'football', turno: 'manha' }))
const config = { formato: 'grupos-mata-mata', grupos: 2, timesPorGrupo: 4 }

test('draw uses every team once, does not mutate inputs, and uses supplied randomness without rerolling during reveal', () => {
  const original = structuredClone(teams)
  const ranges = []
  const result = drawTeamOrder(teams, config, (size) => { ranges.push(size); return 0 })
  assert.deepEqual(ranges, [8, 7, 6, 5, 4, 3, 2])
  assert.deepEqual(result.map((team) => team.id), [...teams.slice(1), teams[0]].map((team) => team.id))
  assert.deepEqual(teams, original)
  result[0].nome = 'Edited'
  assert.deepEqual(teams, original)
  const secure = drawTeamOrder(teams, config)
  assert.deepEqual(secure.map((team) => team.id).sort(), teams.map((team) => team.id).sort())
  assert.throws(() => drawTeamOrder(teams, config, () => 100), /gerar o sorteio/)
})

test('draw refuses duplicate, invalid or excluded teams and fractional or insufficient group capacity', () => {
  assert.match(validateDraw([], config), /pelo menos duas/)
  assert.match(validateDraw([teams[0], teams[0]], config), /cadastro/)
  assert.match(validateDraw([{ ...teams[0], nome: '' }, teams[1]], config), /cadastro/)
  assert.match(validateDraw(teams, { ...config, grupos: 1 }), /todas as 8 turmas/)
  assert.match(validateDraw(teams, { ...config, grupos: 3 }), /todas as 8 turmas/)
  assert.match(validateDraw(teams, { ...config, grupos: 1.5 }), /inteira/)
  assert.match(validateDraw(teams, { ...config, timesPorGrupo: 1 }), /pelo menos duas/)
  assert.match(validateDraw(teams, { formato: 'invalid' }), /formato/)
  assert.throws(() => drawTeamOrder(teams, { ...config, grupos: 1 }), /todas as 8 turmas/)
})

test('group and matchup slots match exactly the order consumed by the existing generator, including odd byes and afternoon', () => {
  const groups = drawSections(teams, config)
  assert.deepEqual(groups.map((group) => group.label), ['Grupo A', 'Grupo B'])
  assert.deepEqual(groups[0].slots.map(({ team }) => team.id), teams.slice(0, 4).map((team) => team.id))
  assert.deepEqual(groups.flatMap((group) => group.slots.map((slot) => slot.index)), [0, 1, 2, 3, 4, 5, 6, 7])
  const afternoon = teams.slice(0, 6).map((team) => ({ ...team, turno: 'tarde' }))
  const afternoonConfig = { ...config, timesPorGrupo: 3 }
  assert.equal(validateDraw(afternoon, afternoonConfig), '')
  assert.deepEqual(drawSections(afternoon, afternoonConfig).map((group) => group.slots.length), [3, 3])
  const simple = { formato: 'sorteio' }
  assert.equal(validateDraw(teams.slice(0, 5), simple), '')
  const matches = drawSections(teams.slice(0, 5), simple)
  assert.deepEqual(matches.map((match) => match.slots.length), [2, 2, 1])
  assert.match(matches[2].label, /Sem adversário/)
  const league = drawSections(teams, { formato: 'todos-contra-todos' })
  assert.equal(league.length, 1)
  assert.equal(league[0].slots.length, teams.length)
})

test('draw detects roster, sport, shift and format changes, ignoring irrelevant updates and subscription order', () => {
  const signature = drawFingerprint(teams, config)
  assert.equal(drawFingerprint([...teams].reverse(), config), signature)
  assert.equal(drawFingerprint(teams.map((team) => ({ ...team, playerCount: 20 })), { ...config, dataInicial: '2030-01-01' }), signature)
  for (const field of ['id', 'nome', 'sportId', 'turno', 'turma']) {
    assert.notEqual(drawFingerprint(teams.map((team, index) => index === 0 ? { ...team, [field]: 'changed' } : team), config), signature)
  }
  assert.notEqual(drawFingerprint(teams.slice(1), config), signature)
  assert.notEqual(drawFingerprint(teams, { ...config, timesPorGrupo: 3 }), signature)
  assert.notEqual(drawFingerprint(teams, { formato: 'sorteio' }), signature)
  assert.equal(drawFingerprint(teams, { formato: 'sorteio', grupos: 10 }), drawFingerprint(teams, { formato: 'sorteio', grupos: 2 }))
})
