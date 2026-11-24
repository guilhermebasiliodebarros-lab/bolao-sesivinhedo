import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRosterSyncPlan } from '../scripts/lib/roster-sync.mjs'
import { SCHOOL_CLASSES } from '../src/utils/schoolClasses.js'
import { parseRosterText } from '../src/utils/rosterImport.js'

const source = { file: 'inscricoes-ficticias.pdf', sha256: 'a'.repeat(64) }
const group = (classCode, players, sport = 'basquete') => ({ sport, classCode, sourcePages: [3], players })
const manifest = (groups) => ({ version: 1, source, groups })
const initial = () => ({ sports: [{ id: 'basket', nome: 'Basquete' }], teams: SCHOOL_CLASSES.map(({ code, ...info }) => ({ id: code, ...info, sportId: 'basket', esporteNome: 'Basquete', playerCount: 0 })), players: [] })
function applyPlan(input, plan) {
  const result = structuredClone(input)
  for (const change of plan.changes) {
    const [collection, id, nested, playerId] = change.path.split('/')
    const target = nested ? result.players : result[collection]
    const index = target.findIndex((item) => item.id === (playerId || id) && (!nested || item.teamId === id))
    const value = { ...target[index], ...structuredClone(change.fields), id: playerId || id, ...(nested ? { teamId: id } : {}) }
    if (index >= 0) target[index] = value; else target.push(value)
  }
  return result
}

test('registration batches preserve existing player IDs and absent students/classes while updating only supplied roles', () => {
  const input = initial()
  input.players.push({ id: 'ana-existing', teamId: '9-b', nome: 'Ana Silva', posicao: 'Titular', capitao: true }, { id: 'bia-existing', teamId: '9-b', nome: 'Bia Costa', posicao: 'Reserva' }, { id: 'other-class', teamId: '6-a', nome: 'Aluno anterior', posicao: 'Titular' })
  input.teams.find((team) => team.id === '9-b').playerCount = 2
  const before = structuredClone(input)
  const plan = buildRosterSyncPlan(input, manifest([group('9-b', [{ nome: 'Ana Silva', posicao: 'Reserva' }, { nome: 'Carla Souza' }])]))
  const after = applyPlan(input, plan)
  assert.equal(plan.summary.createPlayers, 1)
  assert.equal(plan.summary.updatePlayers, 1)
  assert.equal(after.players.find((player) => player.id === 'ana-existing').posicao, 'Reserva')
  assert.equal(after.players.find((player) => player.id === 'ana-existing').capitao, true)
  assert.deepEqual(after.players.find((player) => player.id === 'bia-existing'), before.players[1])
  assert.deepEqual(after.players.find((player) => player.id === 'other-class'), before.players[2])
  assert.equal(after.teams.find((team) => team.id === '9-b').playerCount, 3)
  assert.deepEqual(input, before)
})

test('reimporting is idempotent even when Firestore returns source map keys in a different order', () => {
  const input = initial(), file = manifest([group('9-b', [{ nome: 'Aluno de teste', posicao: 'Titular' }])])
  const first = buildRosterSyncPlan(input, file), after = applyPlan(input, first)
  after.players[0].registrationSource = Object.fromEntries(Object.entries(after.players[0].registrationSource).reverse())
  assert.equal(buildRosterSyncPlan(after, file).changes.length, 0)
  const next = buildRosterSyncPlan(after, manifest([group('6-b', [{ nome: 'Outro aluno', posicao: 'Reserva' }])]))
  assert.equal(next.summary.createPlayers, 1)
  assert(!next.changes.some((change) => change.path.startsWith('teams/9-b')))
})

test('missing FIFA and RPG get separate sports and school teams without inventing matches or sharing players', () => {
  const input = initial(), file = manifest([group('9-b', [{ nome: 'Mesmo aluno' }], 'fifa'), group('9-b', [{ nome: 'Mesmo aluno' }], 'rpg')])
  const plan = buildRosterSyncPlan(input, file), after = applyPlan(input, plan)
  assert.equal(plan.summary.createSports, 2)
  assert.equal(plan.summary.createTeams, 28)
  assert.equal(plan.summary.createPlayers, 2)
  assert.equal(after.sports.find((sport) => sport.nome === 'FIFA').scoringMode, 'goals')
  assert.equal(after.sports.find((sport) => sport.nome === 'RPG').scoringMode, 'points')
  assert.notEqual(after.players[0].teamId, after.players[1].teamId)
  assert(plan.changes.every((change) => /^(sports|teams)\//.test(change.path)))
  assert.equal(buildRosterSyncPlan(after, file).changes.length, 0)
})

test('empty lists do not delete previous registrations and aliases retain the original sport and team IDs', () => {
  const input = initial()
  input.sports[0].nome = 'Futebol'
  input.teams[0].nome = 'Turma 6 A'; input.teams[0].turma = ''
  input.players.push({ id: 'previous', teamId: '6-b', nome: 'Aluno anterior', posicao: 'Reserva' })
  const plan = buildRosterSyncPlan(input, manifest([group('6-a', [{ nome: 'Aluno novo' }], 'futsal'), group('6-b', [], 'futsal')]))
  assert.equal(plan.summary.createSports, 0)
  assert.equal(plan.summary.createTeams, 0)
  assert.equal(plan.expectedPlayers[0].path.split('/')[1], '6-a')
  assert(!plan.changes.some((change) => change.path.startsWith('teams/6-b')))
})

test('ambiguous or duplicated registrations and invalid roles stop the entire plan', () => {
  const input = initial(), rows = [{ nome: 'Aluno teste', posicao: 'Titular' }]
  assert.throws(() => buildRosterSyncPlan(input, manifest([group('9-b', [...rows, ...rows])])), /duas vezes/)
  assert.throws(() => buildRosterSyncPlan(input, manifest([group('9-b', rows), group('9-b', rows)])), /duas vezes/)
  assert.throws(() => buildRosterSyncPlan(input, manifest([group('4-a', rows)])), /inválida/)
  assert.throws(() => buildRosterSyncPlan(input, manifest([group('9-b', [{ nome: 'Aluno teste', posicao: 'Goleiro' }])])), /Titular ou Reserva/)
  input.teams.push({ ...input.teams.find((team) => team.id === '9-b'), id: 'duplicate' })
  assert.throws(() => buildRosterSyncPlan(input, manifest([group('9-b', rows)])), /duplicados/)
})

test('text imports recognize role sections and inline declarations, discard tactical positions and default names to starters', () => {
  const rows = parseRosterText('Ana Silva, Bruno Souza\nReservas:\nCarla Costa\nTitular 1- Diego Lima\nEva Alves:goleira:titular,Flávia Melo:reserva:ala esquerda\nGabriel Souza;reserva:goleiro')
  assert.deepEqual(rows.map((row) => [row.nome, row.posicao]), [['Ana Silva', 'Titular'], ['Bruno Souza', 'Titular'], ['Carla Costa', 'Reserva'], ['Diego Lima', 'Titular'], ['Eva Alves', 'Titular'], ['Flávia Melo', 'Reserva'], ['Gabriel Souza', 'Reserva']])
  assert(rows.every((row) => row.selected && !row.issue))
  const table = parseRosterText('Posição\tNome\nReserva\tHelena Souza\nTitular\tIgor Costa')
  assert.deepEqual(table.map((row) => [row.nome, row.posicao]), [['Helena Souza', 'Reserva'], ['Igor Costa', 'Titular']])
  assert.equal(parseRosterText('João Silva;Goleiro')[0].posicao, 'Titular')
  assert.equal(parseRosterText('Reservas:\nReserva Fictícia de Importação')[0].nome, 'Reserva Fictícia de Importação')
})
