import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSportProfile, validateSportScores, validateFinalSets, normalizeSetScores, normalizeMatchDetails } from '../src/utils/sportRules.js'
import { findScheduleConflicts } from '../src/utils/scheduleConflicts.js'
import { buildInterclassStandings } from '../src/utils/interclassStandings.js'
import { buildTVSchedule, TV_SECTIONS } from '../src/utils/tvSchedule.js'
import { parseRosterText } from '../src/utils/rosterImport.js'
import { calculateGuessScore } from '../src/utils/scoring.js'

test('each modality has a usable score profile and configurable school points', () => {
  assert.equal(getSportProfile({ nome: 'Futebol' }).scoringMode, 'goals')
  assert.equal(getSportProfile({ nome: 'Basquete' }).scoringMode, 'points')
  assert.equal(getSportProfile({ nome: 'Vôlei' }).scoringMode, 'sets')
  assert.equal(getSportProfile({ nome: 'Xadrez' }).drawPoints, 0.5)
  assert.equal(getSportProfile({ nome: 'Xadrez', winPoints: 3 }).winPoints, 3)
  assert.deepEqual(validateSportScores({ esporteNome: 'Xadrez' }, '0.5', '0.5', { final: true }), [0.5, 0.5])
  assert.throws(() => validateSportScores({ esporteNome: 'Xadrez' }, 0, 0, { final: true }))
  assert.throws(() => validateSportScores({ esporteNome: 'Futebol' }, 1.5, 0))
})

test('volleyball validates best-of-three/five results and optional set partials', () => {
  const game = { esporteNome: 'Vôlei', volleyballBestOf: 3 }
  assert.deepEqual(validateSportScores(game, 2, 1, { final: true }), [2, 1])
  assert.throws(() => validateSportScores(game, 1, 1, { final: true }))
  assert.throws(() => validateSportScores(game, 3, 1))
  assert.deepEqual(validateSportScores({ ...game, volleyballBestOf: 5 }, 3, 2, { final: true }), [3, 2])
  const sets = normalizeSetScores([{ a: '25', b: '20' }, { a: 20, b: 25 }, { a: 15, b: 10 }])
  assert.doesNotThrow(() => validateFinalSets(game, 2, 1, sets))
  assert.throws(() => validateFinalSets(game, 2, 0, sets))
  assert.throws(() => normalizeSetScores([{ a: '', b: 0 }]))
})

test('schedule conflicts distinguish shared venues, teams and classes across sports', () => {
  const games = [
    { id: 'a', dataHora: '2026-11-06T10:00', durationMinutes: 30, venue: 'Quadra 1', timeA: 'Azul', timeB: 'Branco', turmaA: '8º A', status: 'aberto' },
    { id: 'finished', dataHora: '2026-11-06T10:00', durationMinutes: 30, venue: 'Quadra 2', status: 'finalizado' },
  ]
  assert.deepEqual(findScheduleConflicts({ dataHora: '2026-11-06T10:10', venue: 'quadra 1', timeA: 'Verde', timeB: 'Preto' }, games)[0].reasons, ['Mesmo local'])
  assert.deepEqual(findScheduleConflicts({ dataHora: '2026-11-06T10:10', venue: 'Quadra 2', turmaB: '8º A' }, games)[0].reasons, ['Mesma equipe ou turma'])
  assert.equal(findScheduleConflicts({ dataHora: '2026-11-06T10:30', venue: 'Quadra 1' }, games).length, 0)
  assert.equal(findScheduleConflicts({ ...games[0] }, games).length, 0)
  assert.equal(normalizeMatchDetails({ venue: ' Quadra 1 ', vestA: 'Azul', vestB: 'Vermelho' }).durationMinutes, 30)
  const teams = [{ id: 'f1', sportId: 'f', nome: 'Azul', turma: '8º A' }, { id: 'v1', sportId: 'v', nome: 'Verde', turma: '8º A' }]
  const oldGame = { ...games[0], sportId: 'f', turmaA: '', teamIdA: 'f1' }
  assert.equal(findScheduleConflicts({ sportId: 'v', timeA: 'Verde', dataHora: '2026-11-06T10:10' }, [oldGame], teams).length, 1)
  assert.equal(findScheduleConflicts({ sportId: 'v', timeA: 'Azul', dataHora: '2026-11-06T10:10' }, [oldGame]).length, 0)
})

test('standings separate groups, tournaments and sports without counting knockout or live results', () => {
  const teams = [{ id: 'a', sportId: 'f', nome: 'Azul', turma: '8º A' }, { id: 'b', sportId: 'f', nome: 'Branco', turma: '8º B' }, { id: 'c', sportId: 'f', nome: 'Verde', turma: '8º A' }, { id: 'unused', sportId: 'f', nome: 'Fora do torneio' }]
  const base = { sportId: 'f', esporteNome: 'Futebol', tournamentId: 't1', tournamentName: 'Interclasse', groupName: 'Grupo A', stageType: 'group', status: 'finalizado' }
  const games = [
    { ...base, timeA: 'Azul', timeB: 'Branco', placarA: 2, placarB: 0 },
    { ...base, timeA: 'Verde', timeB: 'Branco', placarA: 1, placarB: 1 },
    { ...base, timeA: 'Branco', timeB: 'Azul', placarA: 99, placarB: 0, status: 'encerrado' },
    { ...base, groupName: 'Grupo B', timeA: 'Branco', timeB: 'Preto', placarA: 1, placarB: 0 },
    { ...base, groupName: 'Grupo B', timeA: 'Preto', timeB: 'Vermelho', status: 'aberto' },
    { ...base, timeA: 'Azul', timeB: 'Branco', placarA: 99, placarB: 0, stageType: 'knockout' },
    { ...base, timeA: 'Azul', timeB: 'Branco', placarA: 99, placarB: 0, groupName: '' },
    { ...base, tournamentId: 't2', timeA: 'Azul', timeB: 'Branco', placarA: 4, placarB: 0 },
    { ...base, sportId: 'v', esporteNome: 'Vôlei', timeA: 'Azul', timeB: 'Branco', placarA: 2, placarB: 0 },
  ]
  const tables = buildInterclassStandings(games, teams)
  assert.equal(tables.length, 4)
  const groupA = tables.find((table) => table.sportId === 'f' && table.tournamentId === 't1' && table.groupName === 'Grupo A')
  assert.deepEqual(groupA.rows.map((row) => [row.nome, row.pontos]), [['Azul', 3], ['Verde', 1], ['Branco', 1]])
  assert.equal(groupA.rows[0].jogos, 1)
  assert.equal(groupA.rows[0].saldo, 2)
  const groupB = tables.find((table) => table.sportId === 'f' && table.tournamentId === 't1' && table.groupName === 'Grupo B')
  assert.equal(groupB.rows.find((row) => row.nome === 'Branco').pontos, 3)
  assert.equal(groupB.rows.find((row) => row.nome === 'Vermelho').jogos, 0)
  assert(!tables.some((table) => table.rows.some((row) => row.nome === 'Fora do torneio')))
  assert.deepEqual(buildInterclassStandings([], teams), [])
})

test('TV schedule has no standings tab or pages, even when old table options are supplied', () => {
  const schedule = buildTVSchedule([{ sportId: 'f', dataHora: '2026-11-06T10:00', timeA: 'Azul', timeB: 'Branco', status: 'aberto' }], { day: '2026-11-06', tables: [{ id: 'old', rows: [{ nome: 'Azul' }] }] })
  assert(!TV_SECTIONS.some((section) => section.id === 'standings'))
  assert(!schedule.pages.some((page) => page.kind === 'standings'))
  assert(!Object.hasOwn(schedule.counts, 'standings'))
  assert.equal(schedule.pages[0].games.length, 1)
})

test('chess school standings award configurable half-point draws', () => {
  const [table] = buildInterclassStandings([{ sportId: 'chess', esporteNome: 'Xadrez', groupName: 'Grupo A', timeA: '9º A', timeB: '9º B', status: 'finalizado', placarA: 0.5, placarB: 0.5 }])
  assert.deepEqual(table.rows.map((row) => row.pontos), [0.5, 0.5])
})

test('walkovers count in their own group while cancellations and postponements never count', () => {
  const base = { sportId: 'f', esporteNome: 'Futebol', stageType: 'group', groupName: 'Grupo A', timeA: 'Azul', timeB: 'Branco', status: 'finalizado' }
  const wo = { ...base, matchCondition: 'walkover', walkoverWinner: 'B', placarA: null, placarB: null }
  const [table] = buildInterclassStandings([wo, { ...base, matchCondition: 'cancelled', placarA: 99, placarB: 0 }, { ...base, matchCondition: 'postponed', placarA: 99, placarB: 0 }])
  assert.equal(table.rows[0].nome, 'Branco')
  assert.equal(table.rows[0].pontos, 3)
  assert.equal(table.rows[0].jogos, 1)
  assert.equal(table.rows[0].saldo, 0)
  assert.deepEqual(calculateGuessScore(wo, { palpiteA: 0, palpiteB: 3 }), { points: 0, type: 'void' })
})

test('TV separates cancelled and postponed matches from the live and upcoming agenda', () => {
  const base = { sportId: 'f', esporteNome: 'Futebol', dataHora: '2026-11-06T10:00', status: 'encerrado', liveStatus: 'live' }
  const schedule = buildTVSchedule([{ ...base, id: 'p', matchCondition: 'postponed' }, { ...base, id: 'c', matchCondition: 'cancelled' }, { ...base, id: 'wo', status: 'finalizado', matchCondition: 'walkover', walkoverWinner: 'A' }], { day: '2026-11-06' })
  assert.equal(schedule.live.length, 0)
  assert.equal(schedule.counts.today, 0)
  assert.equal(schedule.counts.changes, 2)
  assert.equal(schedule.counts.results, 1)
  assert.deepEqual(new Set(schedule.pages.find((page) => page.kind === 'changes').games.map((game) => game.id)), new Set(['p', 'c']))
})

test('roster previews parse Word-style tables, text lists, captains and duplicates', () => {
  const rows = parseRosterText('Nome\tPosição\tCapitão\nAna Silva\tGoleira\tSim\nBruno Souza\t\tSim\nAna Silva\t\tNão', [{ nome: 'Bruno Souza' }])
  assert.equal(rows[0].nome, 'Ana Silva')
  assert.equal(rows[0].capitao, true)
  assert.equal(rows[1].capitao, true)
  assert.equal(rows[1].selected, false)
  assert.equal(rows[2].selected, false)
  const plain = parseRosterText('Equipe: Azul\n1. Carla Costa\n2) Pedro Santos\n• Maria Oliveira\n06/11/2026')
  assert.equal(plain.filter((row) => row.selected).length, 3)
  assert.equal(plain[0].nome, 'Carla Costa')
})
