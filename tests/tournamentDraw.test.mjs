import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDrawPresentation, drawFingerprint, drawPresentationReducer, drawRevealOrder, drawSections, drawTeamOrder, validateDraw } from '../src/utils/tournamentDraw.js'

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

test('presentation alternates groups without changing the group membership or the order applied to the generator', () => {
  const copy = structuredClone(teams)
  const order = drawRevealOrder(teams, config)
  assert.deepEqual(order.map((entry) => entry.index), [0, 4, 1, 5, 2, 6, 3, 7])
  assert.deepEqual(order.slice(0, 4).map((entry) => entry.destination), ['Grupo A', 'Grupo B', 'Grupo A', 'Grupo B'])
  assert.deepEqual(order.filter((entry) => entry.destination === 'Grupo B').map((entry) => entry.team.id), teams.slice(4).map((team) => team.id))
  assert.deepEqual(teams, copy)
  const six = teams.slice(0, 6)
  assert.deepEqual(drawRevealOrder(six, { ...config, timesPorGrupo: 3 }).map((entry) => entry.index), [0, 3, 1, 4, 2, 5])
  for (const formato of ['sorteio', 'todos-contra-todos']) assert.deepEqual(drawRevealOrder(teams.slice(0, 5), { formato }).map((entry) => entry.index), [0, 1, 2, 3, 4])
})

const finishReveal = (state) => ['show', 'ready', 'open', 'reveal', 'fly', 'land', 'settle'].reduce((value, type) => drawPresentationReducer(value, { type, cycle: value.cycle }), state)

test('replay re-enacts only the last committed reveal and never advances, duplicates or removes a team', () => {
  let state = createDrawPresentation(8)
  assert.deepEqual(drawPresentationReducer(state, { type: 'repeat' }), state)
  state = finishReveal(drawPresentationReducer(state, { type: 'next' }))
  assert.equal(state.count, 1)
  const repeat = drawPresentationReducer(state, { type: 'repeat' })
  assert.equal(repeat.active, 0)
  assert.equal(repeat.replay, true)
  assert.equal(repeat.automatic, false)
  state = finishReveal(repeat)
  assert.equal(state.count, 1)
  state = finishReveal(drawPresentationReducer(state, { type: 'next' }))
  assert.equal(state.active, 1)
  assert.equal(state.count, 2)
  state = drawPresentationReducer(state, { type: 'skip' })
  state = finishReveal(drawPresentationReducer(state, { type: 'repeat' }))
  assert.equal(state.count, 8)
  assert.equal(state.active, 7)
})

test('pausing finishes the current reveal, skipping invalidates old timers, and double clicks cannot consume extra teams', () => {
  let state = drawPresentationReducer(createDrawPresentation(6), { type: 'automatic' })
  assert.equal(state.phase, 'mixing')
  assert.deepEqual(drawPresentationReducer(state, { type: 'next' }), state)
  state = drawPresentationReducer(state, { type: 'pause' })
  state = finishReveal(state)
  assert.equal(state.count, 1)
  assert.deepEqual(drawPresentationReducer(state, { type: 'advance' }), state)
  assert.deepEqual(drawPresentationReducer(state, { type: 'land', cycle: state.cycle }), state)
  state = drawPresentationReducer(state, { type: 'automatic' })
  const oldCycle = state.cycle
  state = drawPresentationReducer(state, { type: 'skip' })
  assert.equal(state.count, 6)
  state = drawPresentationReducer(state, { type: 'repeat' })
  assert.deepEqual(drawPresentationReducer(state, { type: 'show', cycle: oldCycle }), state)
  state = finishReveal(state)
  assert.equal(state.count, 6)
  assert.equal(state.active, 5)
})

test('the capsule ejects and opens before the team is revealed, and the finale waits for the landing to finish', () => {
  let state = drawPresentationReducer(createDrawPresentation(1), { type: 'next' })
  for (const [action, phase] of [['show', 'ejecting'], ['ready', 'ready'], ['open', 'opening'], ['reveal', 'revealing'], ['fly', 'flying']]) {
    state = drawPresentationReducer(state, { type: action, cycle: state.cycle })
    assert.equal(state.phase, phase)
    assert.equal(state.count, 0)
    assert.equal(state.celebrated, false)
  }
  state = drawPresentationReducer(state, { type: 'land', cycle: state.cycle })
  assert.equal(state.count, 1)
  assert.equal(state.phase, 'landing')
  assert.equal(state.celebrated, false)
  assert.deepEqual(drawPresentationReducer(state, { type: 'repeat' }), state)
  state = drawPresentationReducer(state, { type: 'settle', cycle: state.cycle })
  assert.equal(state.phase, 'settled')
  assert.equal(state.celebrated, true)
  assert.equal(finishReveal(drawPresentationReducer(state, { type: 'repeat' })).count, 1)
})

test('the ball waits for a click in automatic mode and ignores premature or repeated opening', () => {
  let state = drawPresentationReducer(createDrawPresentation(8), { type: 'automatic' })
  assert.deepEqual(drawPresentationReducer(state, { type: 'open' }), state)
  state = drawPresentationReducer(state, { type: 'show' })
  assert.deepEqual(drawPresentationReducer(state, { type: 'open' }), state)
  state = drawPresentationReducer(state, { type: 'ready' })
  for (const type of ['advance', 'reveal', 'fly', 'next', 'land', 'settle']) {
    assert.deepEqual(drawPresentationReducer(state, { type }), state)
  }
  assert.equal(state.count, 0)
  assert.equal(state.automatic, true)
  state = drawPresentationReducer(state, { type: 'open' })
  assert.equal(state.phase, 'opening')
  assert.deepEqual(drawPresentationReducer(state, { type: 'open' }), state)
  state = finishReveal(state)
  assert.equal(state.count, 1)
  assert.equal(drawPresentationReducer(state, { type: 'advance' }).phase, 'mixing')
})
