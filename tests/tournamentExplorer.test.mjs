import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bracketParticipant, bracketPath, buildBracket, canSimulateGame, indicatedQualifiers, listCompetitions, qualificationAtCut, simulateStandings, simulationFingerprint } from '../src/utils/tournamentExplorer.js'

const base = { sportId: 'football', esporteNome: 'Futebol', tournamentId: 'cup', tournamentName: 'Copa', turno: 'manha', status: 'aberto', stageType: 'group', groupName: 'Grupo A', fase: 'Fase de grupos' }
const game = (id, a, b, extra = {}) => ({ ...base, id, timeA: a, timeB: b, ...extra })
const draft = (match, a, b) => ({ a: String(a), b: String(b), fingerprint: simulationFingerprint(match) })

test('public competitions separate modalities, shifts and tournaments, including legacy unnamed tournaments', () => {
  const games = [game('a', '9º A', '9º B'), game('b', '6º A', '6º B', { turno: 'tarde' }), game('c', '9º A', '9º B', { tournamentId: 'another' }), game('d', '9º A', '9º B', { sportId: 'chess', esporteNome: 'Xadrez' }), game('e', '9º A', '9º B', { tournamentId: '', tournamentName: '' })]
  const cups = listCompetitions(games)
  assert.equal(cups.length, 5)
  assert(cups.every((cup) => cup.games.length === 1))
  assert.equal(cups.find((cup) => cup.games[0].id === 'e').name, 'Jogos sem torneio definido')
})

const knockout = (id, phase, a, b, extra = {}) => game(id, a, b, { stageType: 'knockout', groupName: '', fase: phase, rodada: `${phase} ${id}`, ...extra })
test('bracket follows explicit source IDs, lays out rounds, highlights a path and derives the official champion', () => {
  const games = [knockout('s1', 'Semifinal', '9º A', '1º A', { status: 'finalizado', placarA: 2, placarB: 0 }), knockout('s2', 'Semifinal', '2º A', '3º A', { status: 'finalizado', placarA: 1, placarB: 3 }), knockout('f', 'Final', 'Vencedor semifinal 1', 'Vencedor semifinal 2', { sourceGameIdA: 's1', sourceGameIdB: 's2' })]
  const graph = buildBracket(games)
  assert.equal(graph.edges.length, 2); assert.equal(graph.rounds.length, 2)
  assert(graph.byId.get('f').x > graph.byId.get('s1').x)
  assert.equal(bracketParticipant(graph.byId.get('f'), 'A', graph), '9º A')
  assert.equal(bracketParticipant(graph.byId.get('f'), 'B', graph), '3º A')
  assert.deepEqual([...bracketPath(graph, 's1')].sort(), ['f', 's1'])
  assert.equal(graph.champion, '')
  const final = { ...games[2], status: 'finalizado', timeA: '9º A', timeB: '3º A', placarA: 0, placarB: 1 }
  assert.equal(buildBracket([...games.slice(0, 2), final]).champion, '3º A')
})

test('bracket does not invent links, mix competitions or expose a champion without a decided final', () => {
  const same = [knockout('s', 'Semifinal', '9º A', '1º A'), knockout('f', 'Final', '2º A', '3º A')]
  assert.equal(buildBracket(same).edges.length, 0)
  const crossed = buildBracket([same[0], { ...same[1], sourceGameIdA: 's', turno: 'tarde' }])
  assert.equal(crossed.edges.length, 0); assert.equal(crossed.missingLinks, 1)
  assert.equal(buildBracket([{ ...same[1], status: 'finalizado', placarA: 1, placarB: 1 }]).champion, '')
  assert.equal(buildBracket([{ ...same[1], status: 'finalizado', placarA: 1, placarB: 1, tieBreak: { method: 'penalties', scoreA: 3, scoreB: 4 } }]).champion, '3º A')
  assert.equal(buildBracket([{ ...same[1], status: 'finalizado', matchCondition: 'walkover', walkoverWinner: 'A' }]).champion, '2º A')
  assert.equal(buildBracket([{ ...same[1], status: 'finalizado', placarA: 1, placarB: 0, matchCondition: 'cancelled' }]).champion, '')
})

test('legacy next-game links are supported and broken cyclic references terminate safely', () => {
  const graph = buildBracket([knockout('a', 'Semifinal', '9º A', '9º B', { nextGameId: 'f', nextGameSlot: 'A' }), knockout('f', 'Final', 'A definir', 'A definir')])
  assert.equal(graph.edges.length, 1)
  const cycle = buildBracket([knockout('a', 'Semifinal', 'A', 'B', { sourceGameIdA: 'b' }), knockout('b', 'Final', 'C', 'D', { sourceGameIdA: 'a' })])
  assert.equal(cycle.cycle, true); assert.equal(cycle.edges.length, 0)
  assert(Number.isFinite(cycle.height))
})

test('hypothetical results move group positions without mutating official games or guesses', () => {
  const matches = [game('played', '9º A', '9º B', { status: 'finalizado', placarA: 0, placarB: 1 }), game('pending', '9º A', '1º A'), game('last', '9º B', '1º A')]
  const before = structuredClone(matches)
  const result = simulateStandings(matches, { pending: draft(matches[1], 4, 0) })
  assert.equal(result.applied.size, 1); assert.equal(result.remaining, 1)
  assert.equal(result.tables[0].rows[0].nome, '9º A')
  assert.equal(result.tables[0].rows[0].pontos, 3)
  assert.equal(result.tables[0].rows[0].jogos, 2)
  assert(result.tables[0].rows[0].movement > 0)
  assert.deepEqual(matches, before)
  assert.equal(result.official[0].rows[0].nome, '9º B')
  assert.equal(simulateStandings(matches).tables[0].rows[0].nome, '9º B')
})

test('simulator ignores completed and cancelled matches, and reports incomplete or stale scenarios', () => {
  const pending = game('pending', '9º A', '9º B')
  const played = { ...pending, id: 'played', status: 'finalizado', placarA: 1, placarB: 0 }
  const cancelled = { ...pending, id: 'cancelled', matchCondition: 'cancelled' }
  assert.equal(canSimulateGame(played), false); assert.equal(canSimulateGame(cancelled), false)
  const result = simulateStandings([pending, played, cancelled], { pending: draft(pending, '', 1), played: draft(played, 0, 9), cancelled: draft(cancelled, 0, 9) })
  assert.equal(result.applied.size, 0); assert.equal(Object.keys(result.issues).length, 3)
  assert.equal(result.tables[0].rows[0].nome, '9º A')
  const changed = { ...pending, timeB: '2º A' }
  assert.match(simulateStandings([changed], { pending: draft(pending, 1, 0) }).issues.pending, /alterado/)
  assert.equal(simulationFingerprint(pending), simulationFingerprint({ ...pending, venue: 'Quadra 2', clock: { elapsedMs: 5000 } }), 'Venue and clock updates do not invalidate the scenario')
})

test('score validation follows volleyball sets, chess half points and custom school points', () => {
  const volleyball = game('volley', '9º A', '9º B', { esporteNome: 'Vôlei', sportId: 'volley', volleyballBestOf: 5, winPoints: 5, lossPoints: 2 })
  assert.equal(simulateStandings([volleyball], { volley: draft(volleyball, 2, 1) }).applied.size, 0)
  const valid = simulateStandings([volleyball], { volley: draft(volleyball, 3, 2) })
  assert.deepEqual(valid.tables[0].rows.map((row) => row.pontos), [5, 2])
  const chess = game('chess', '9º A', '9º B', { esporteNome: 'Xadrez', sportId: 'chess' })
  assert.deepEqual(simulateStandings([chess], { chess: draft(chess, 0.5, 0.5) }).tables[0].rows.map((row) => row.pontos), [0.5, 0.5])
  assert.equal(simulateStandings([chess], { chess: draft(chess, 2, 0) }).applied.size, 0)
})

test('remaining matches from another group do not suggest that a completed group can still change', () => {
  const a = game('a', '9º A', '9º B')
  const b = game('b', '1º A', '1º B', { groupName: 'Grupo B' })
  const result = simulateStandings([a, b], { a: draft(a, 1, 0) })
  assert.equal(result.remaining, 1)
  assert.equal(result.remainingByTable[result.tables.find((table) => table.groupName === 'Grupo A').id], 0)
  assert.equal(result.remainingByTable[result.tables.find((table) => table.groupName === 'Grupo B').id], 1)
})

test('hypothetical rounds never count knockout games and preserve official walkovers', () => {
  const pending = game('p', '9º A', '9º B')
  const final = knockout('f', 'Final', '9º A', '9º B')
  const wo = game('wo', '1º A', '2º A', { status: 'finalizado', matchCondition: 'walkover', walkoverWinner: 'B', placarA: null, placarB: null })
  const result = simulateStandings([pending, final, wo], { f: draft(final, 99, 0), p: draft(pending, 1, 0) })
  assert.equal(result.applied.size, 1)
  assert.equal(result.tables[0].rows.find((row) => row.nome === '2º A').pontos, 3)
  assert.equal(result.tables[0].rows.find((row) => row.nome === '9º A').pro, 1)
})

test('league simulations have a general table and tied cutoff teams are never declared qualified by name', () => {
  const match = game('league', '9º A', '9º B', { stageType: 'league', groupName: '' })
  const result = simulateStandings([match], { league: draft(match, 1, 1) })
  assert.equal(result.tables[0].groupName, 'Classificação geral')
  assert.deepEqual(qualificationAtCut(result.tables[0], 1), ['tie', 'tie'])
  assert.deepEqual(qualificationAtCut(result.tables[0], 2), ['inside', 'inside'])
})

test('qualification suggestions come from published bracket seeds and survive official group advancement', () => {
  const seeds = [knockout('s', 'Semifinal', '1o Grupo A', '2o Grupo A', { seedLabelA: '1o Grupo A', seedLabelB: '2o Grupo A' })]
  assert.equal(indicatedQualifiers(seeds, 'Grupo A'), 2)
  assert.equal(indicatedQualifiers([{ ...seeds[0], seedLabelA: '', seedLabelB: '', qualifierSeedA: '1o Grupo A', qualifierSeedB: '2o Grupo A' }], 'Grupo A'), 2)
  assert.equal(indicatedQualifiers(seeds, 'Grupo B'), null)
})
