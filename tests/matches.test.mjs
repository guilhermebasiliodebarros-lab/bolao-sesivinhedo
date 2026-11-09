import { registerHooks } from 'node:module'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { getMatchScore, getMatchState, MATCH_STATE } from '../src/utils/match.js'
import { attendanceTeamKey } from '../src/utils/attendance.js'
import { isMatchPrepared } from '../src/utils/matchStart.js'
import { resolveCompetitionShifts } from '../src/utils/schoolShifts.js'
import { scheduleFingerprint, buildScheduleRedistribution, schedulePlanFingerprint } from '../src/utils/tournamentSchedule.js'

// Exercise the service against an isolated store, never the production Firebase project.
const documents = new Map()
let generatedId = 0
let useCurrentTimestamp = false
const snapshot = (ref) => ({ id: ref.id, ref, exists: () => documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) })
const apply = (ref, fields) => {
  if (!documents.has(ref.path)) throw new Error('Document not found')
  documents.set(ref.path, { ...documents.get(ref.path), ...structuredClone(fields) })
}
const sdk = {
  collection: (_db, ...segments) => ({ name: segments.join('/') }),
  doc: (parent, ...segments) => {
    const path = parent.name ? `${parent.name}/${segments.join('/') || `auto-${++generatedId}`}` : segments.join('/')
    return { path, id: path.split('/').at(-1) }
  },
  getDoc: async (ref) => snapshot(ref),
  getDocs: async (query) => {
    const docs = [...documents.keys()].filter((path) => path.split('/').slice(0, -1).join('/') === query.name).map((path) => snapshot({ path, id: path.split('/').at(-1) })).filter((doc) => (query.filters || []).every((filter) => doc.data()[filter.field] === filter.value))
    return { docs, empty: !docs.length, size: docs.length, forEach: (callback) => docs.forEach(callback) }
  },
  query: (collection, ...filters) => ({ ...collection, filters }),
  where: (field, operator, value) => { assert.equal(operator, '=='); return { field, value } },
  runTransaction: async (_db, callback) => {
    const changes = []
    const result = await callback({ get: async (ref) => snapshot(ref), update: (ref, fields) => changes.push(() => apply(ref, fields)), set: (ref, fields) => changes.push(() => documents.set(ref.path, structuredClone(fields))), delete: (ref) => changes.push(() => documents.delete(ref.path)) })
    changes.forEach((commit) => commit())
    return result
  },
  updateDoc: async (ref, fields) => apply(ref, fields),
  writeBatch: () => {
    const changes = []
    return { set: (ref, fields) => changes.push(() => documents.set(ref.path, structuredClone(fields))), update: (ref, fields) => changes.push(() => apply(ref, fields)), delete: (ref) => changes.push(() => documents.delete(ref.path)), commit: async () => changes.forEach((commit) => commit()) }
  },
  serverTimestamp: () => useCurrentTimestamp ? new Date() : new Date('2026-11-06T12:00:00Z'),
  Timestamp: { fromDate: (date) => date },
  onSnapshot: () => { throw new Error('Unexpected listener in a service test') },
  setDoc: async (ref, fields) => documents.set(ref.path, structuredClone(fields)),
  deleteDoc: async (ref) => documents.delete(ref.path),
}
globalThis.__matchTestSdk = sdk
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'firebase/firestore') return { url: 'test:firestore', shortCircuit: true }
    if (specifier === './firebase.js' && context.parentURL?.endsWith('/services/firestoreService.js')) return { url: 'test:config', shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'test:config') return { format: 'module', source: 'export const db = {}', shortCircuit: true }
    if (url === 'test:firestore') return { format: 'module', source: Object.keys(sdk).map((name) => `export const ${name} = globalThis.__matchTestSdk.${name};`).join('\n'), shortCircuit: true }
    return next(url, context)
  },
})
const { normalizeGame, startGame, updateLiveScore, finalizeGame, reopenGame, closeGame, saveGame, canEditPrediction, savePlayer, deletePlayer, deleteTeam, importPlayers, saveAnnouncement, changeMatchCondition, saveMatchReport, loadMatchReport, calculateGroupStandings, saveMatchAttendance, saveBroadcastSettings, saveGamePreparation, startPreparedGames, controlMatchClock, saveSportRegulation, saveSport, recordLiveEvent, undoLiveEvent, redistributeTournamentSchedule, saveTeam, saveGames } = await import('../src/services/firestoreService.js')
const original = {
  sportId: 'football', esporteNome: 'Futebol', fase: 'Fase de grupos', rodada: 'Rodada 1',
  timeA: 'Azul', timeB: 'Branco', status: 'aberto', dataHora: '2099-11-06T12:00', limitePalpites: '2099-11-06T11:00',
  venue: 'Quadra 1', vestA: 'Azul', vestB: 'Amarelo',
  attendanceSummary: { teamKey: '["football","Azul","Branco"]', teamA: 'present', teamB: 'present' },
}
const game = (id = 'one') => normalizeGame(id, documents.get(`games/${id}`))
const preparationFor = (id, area = '') => ({ expectedTeamKey: attendanceTeamKey(game(id)), venue: 'Quadra principal', venueArea: area, vestA: 'Azul', vestB: 'Amarelo', responsible: 'Professor responsável', sides: { A: { status: 'present', players: {} }, B: { status: 'present', players: {} } } })
beforeEach(() => { useCurrentTimestamp = false; documents.clear(); documents.set('games/one', structuredClone(original)) })

test('saving a new modality creates its fourteen class teams in the same batch', async () => {
  await saveSport({ nome: 'Tênis de Mesa' })
  const [path, sport] = [...documents].find(([key]) => key.startsWith('sports/'))
  const sportId = path.split('/')[1]
  const teams = [...documents].filter(([key, value]) => key.startsWith('teams/') && value.sportId === sportId).map(([, value]) => value)
  assert.equal(sport.schoolClassesVersion, 1)
  assert.equal(teams.length, 14)
  assert.equal(teams.filter((team) => team.turno === 'manha').length, 8)
  assert.equal(teams.filter((team) => team.turno === 'tarde').length, 6)
  assert(teams.every((team) => team.esporteNome === 'Tênis de Mesa' && team.turma === team.nome && team.playerCount === 0))
  await saveSport({ id: sportId, nome: 'Tênis de mesa atualizado' })
  assert.equal([...documents].filter(([key]) => key.startsWith('teams/')).length, 14)
  assert.deepEqual(documents.get('games/one'), original)
})

test('existing games remain scheduled; unknown final scores are never invented', () => {
  assert.equal(getMatchState(game()), MATCH_STATE.SCHEDULED)
  assert.equal(getMatchState({ status: 'finalizado', liveStatus: 'live' }), MATCH_STATE.FINISHED)
  assert.equal(getMatchState({ status: 'finished', liveStatus: 'live' }), MATCH_STATE.FINISHED)
  assert.deepEqual(getMatchScore({ status: 'finalizado' }), ['–', '–'])
})

test('starting closes predictions and supports simultaneous matches', async () => {
  const second = { ...original, sportId: 'volleyball', esporteNome: 'Vôlei', venue: 'Quadra 2' }
  documents.set('games/two', { ...second, attendanceSummary: { ...second.attendanceSummary, teamKey: attendanceTeamKey(second) } })
  await Promise.all([startGame('one'), startGame('two')])
  for (const id of ['one', 'two']) {
    assert.equal(getMatchState(game(id)), MATCH_STATE.LIVE)
    assert.equal(game(id).status, 'encerrado')
    assert.equal(canEditPrediction(game(id)), false)
    assert(game(id).startedAt)
  }
})

test('persisted clocks pause, resume, reject stale controls and stop on finalization', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-06T12:00:00Z') })
  useCurrentTimestamp = true
  await startGame('one')
  assert.equal(game().clock.revision, 1)
  context.mock.timers.tick(5000)
  await controlMatchClock({ gameId: 'one', action: 'pause', expectedRevision: 1 })
  assert.equal(game().clock.elapsedMs, 5000)
  assert.equal(game().clock.runningSince, null)
  await assert.rejects(controlMatchClock({ gameId: 'one', action: 'pause', expectedRevision: 1 }), /Outro responsável/)
  context.mock.timers.tick(60000)
  await controlMatchClock({ gameId: 'one', action: 'resume', expectedRevision: 2 })
  assert.equal(game().clock.elapsedMs, 5000)
  context.mock.timers.tick(5000)
  await finalizeGame({ gameId: 'one', placarA: 2, placarB: 1 })
  assert.equal(game().clock.elapsedMs, 10000)
  assert.equal(game().clock.runningSince, null)
  await assert.rejects(controlMatchClock({ gameId: 'one', action: 'resume', expectedRevision: game().clock.revision }), /ao vivo/)
  await reopenGame('one')
  assert.equal(game().clock, null)
})

test('postponement freezes play time until a prepared match resumes', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-06T12:00:00Z') })
  useCurrentTimestamp = true
  await startGame('one')
  context.mock.timers.tick(20000)
  await changeMatchCondition({ gameId: 'one', action: 'postpone', reason: 'Chuva forte' })
  assert.equal(game().clock.elapsedMs, 20000)
  assert.equal(game().clock.runningSince, null)
  context.mock.timers.tick(3600000)
  await changeMatchCondition({ gameId: 'one', action: 'reschedule', reason: 'Retorno da partida', dataHora: '2026-11-07T09:00', limitePalpites: '2026-11-07T08:00' })
  await startGame('one', preparationFor('one'))
  context.mock.timers.tick(5000)
  await controlMatchClock({ gameId: 'one', action: 'pause', expectedRevision: game().clock.revision })
  assert.equal(game().clock.elapsedMs, 25000)
})

test('public regulations save independently of scoring settings and reject concurrent overwrites', async () => {
  documents.set('sports/football', { nome: 'Futebol', winPoints: 3 })
  const revision = await saveSportRegulation('football', { walkover: 'Orientações da escola' }, 0)
  assert.equal(revision, 1)
  assert.equal(documents.get('sports/football').regulation.walkover, 'Orientações da escola')
  assert.equal(documents.get('sports/football').winPoints, 3)
  await assert.rejects(saveSportRegulation('football', { notes: 'Versão antiga' }, 0), /Outro responsável/)
  await saveSport({ id: 'football', nome: 'Futebol', winPoints: 4 })
  assert.equal(documents.get('sports/football').regulation.walkover, 'Orientações da escola')
  await assert.rejects(saveSportRegulation('missing', {}, 0), /não encontrada/)
})

test('new teams and tournaments persist a shift and cannot mix morning and afternoon squads', async () => {
  await saveTeam({ sportId: 'football', esporteNome: 'Futebol', nome: '6ºA', turno: 'tarde' })
  assert([...documents.values()].some((team) => team.nome === '6ºA' && team.turno === 'tarde'))
  await assert.rejects(saveTeam({ sportId: 'football', esporteNome: 'Futebol', nome: '6ºB', turno: 'manha' }), /pertence ao turno/)
  const match = { ...original, id: 'morning-match', timeA: '9ºA', timeB: '9ºB', turno: 'manha', tournamentId: 'morning-cup', tournamentName: 'Interclasse 2026', stageType: 'group' }
  await saveGames([match])
  assert.equal(documents.get('games/morning-match').turno, 'manha')
  await assert.rejects(saveGames([{ ...match, id: 'mixed', timeB: '6ºA' }]), /não podem disputar/)
  assert.equal(documents.has('games/mixed'), false)
  await assert.rejects(saveGames([{ ...match, id: 'bad-cup', timeA: '6ºA', timeB: '6ºB', turno: 'tarde' }]), /torneio pertence a outro turno/)
  await saveGames([{ ...match, id: 'afternoon-match', timeA: '6ºA', timeB: '6ºB', turno: 'tarde', tournamentId: 'afternoon-cup' }, { ...match, id: 'afternoon-final', timeA: '1o Grupo A', timeB: '2o Grupo B', seedLabelA: '1o Grupo A', seedLabelB: '2o Grupo B', turno: 'tarde', tournamentId: 'afternoon-cup', stageType: 'knockout' }])
  assert.equal(documents.get('games/afternoon-match').turno, 'tarde')
  assert.equal(documents.get('games/afternoon-final').turno, 'tarde')
  await assert.rejects(saveGames([{ ...match, id: 'unassigned', turno: '', timeA: 'Azul', timeB: 'Branco', tournamentId: 'unassigned' }]), /Selecione Manhã ou Tarde/)
})

test('redistributing existing games preserves IDs, predictions, match metadata and knockout dates atomically', async () => {
  const groups = [['9ºA', '9ºB', '1ºA', '1ºB'], ['2ºA', '2ºB', '3ºA', '3ºB']]
  let index = 0
  groups.forEach((teams, group) => teams.forEach((timeA, first) => teams.slice(first + 1).forEach((timeB) => {
    const date = new Date(Date.UTC(2099, 10, 30, 10, index * 12))
    documents.set(`games/order-${index}`, { ...original, timeA, timeB, tournamentId: 'cup', stageType: 'group', groupName: `Grupo ${group}`, dataHora: date.toISOString(), limitePalpites: new Date(date.getTime() - 3600000), preparation: { key: 'old' } })
    index += 1
  })))
  documents.set('games/semi', { ...original, tournamentId: 'cup', stageType: 'knockout', seedLabelA: '1o Grupo A' })
  documents.set('predictions/guess', { gameId: 'order-1', palpiteA: 2, palpiteB: 1, userId: 'teacher' })
  const selected = resolveCompetitionShifts([...documents].filter(([path, data]) => path.startsWith('games/') && data.tournamentId === 'cup').map(([path]) => game(path.split('/')[1])))
  const expectedGames = selected.map((match) => ({ id: match.id, fingerprint: scheduleFingerprint(match) }))
  const before = structuredClone(Object.fromEntries(documents))
  documents.set('games/order-1', { ...documents.get('games/order-1'), timeA: 'Changed' })
  await assert.rejects(redistributeTournamentSchedule({ tournamentId: 'cup', expectedGames }), /partida mudaram/)
  assert.deepEqual(documents.get('games/order-5'), before['games/order-5'])
  documents.set('games/order-1', before['games/order-1'])
  const plan = buildScheduleRedistribution(selected, new Date())
  await assert.rejects(redistributeTournamentSchedule({ tournamentId: 'cup', expectedGames, expectedPlan: 'expired-preview' }), /horários disponíveis mudaram/)
  const count = await redistributeTournamentSchedule({ tournamentId: 'cup', expectedGames, expectedPlan: schedulePlanFingerprint(plan) })
  assert.equal(count, plan.changes.length)
  assert.deepEqual(documents.get('predictions/guess'), before['predictions/guess'])
  assert.deepEqual(documents.get('games/semi'), before['games/semi'])
  for (const match of selected.filter((item) => item.stageType === 'group')) {
    const saved = documents.get(`games/${match.id}`)
    for (const field of ['timeA', 'timeB', 'tournamentId', 'groupName', 'stageType', 'status', 'venue', 'vestA', 'vestB']) assert.equal(saved[field], before[`games/${match.id}`][field])
    assert.equal(new Date(saved.dataHora) - saved.limitePalpites, 3600000)
    if (plan.changes.some((change) => change.id === match.id)) assert.equal(saved.preparation, null)
  }
})

test('live events publish only the first name, increment atomically, deduplicate retries and undo safely', async () => {
  await startGame('one')
  documents.set('games/one/documents/attendance', { teamKey: attendanceTeamKey(game()), A: { status: 'present', players: [{ id: 'ana', nome: 'Ana Silva Santos', status: 'present' }] }, B: { status: 'present', players: [] } })
  const input = { gameId: 'one', requestId: 'goal-00001', side: 'A', playerId: 'ana', expectedScoreRevision: 0 }
  await recordLiveEvent(input)
  assert.equal(game().liveScoreA, 1)
  assert.equal(game().liveEvents[0].playerName, 'Ana')
  assert.equal(JSON.stringify(game()).includes('Silva'), false)
  await recordLiveEvent(input)
  assert.equal(game().liveScoreA, 1)
  await assert.rejects(recordLiveEvent({ ...input, requestId: 'goal-00002' }), /placar mudou/)
  await assert.rejects(recordLiveEvent({ ...input, requestId: 'goal-00003', side: 'B', expectedScoreRevision: 1 }), /jogador presente/)
  await undoLiveEvent({ gameId: 'one', eventId: input.requestId, expectedScoreRevision: 1 })
  assert.equal(game().liveScoreA, 0)
  assert.equal(game().scorerStats.length, 0)
  assert.equal(game().liveEvents.length, 0)
  await recordLiveEvent({ gameId: 'one', requestId: 'goal-00004', side: 'B', expectedScoreRevision: 2 })
  assert.equal(game().liveScoreB, 1)
  await assert.rejects(updateLiveScore({ gameId: 'one', placarA: 0, placarB: 0, expectedScoreRevision: 0 }), /placar mudou/)
  await assert.rejects(finalizeGame({ gameId: 'one', placarA: 0, placarB: 0, expectedScoreRevision: 0 }), /placar mudou/)
  await updateLiveScore({ gameId: 'one', placarA: 2, placarB: 0, expectedScoreRevision: 3 })
  assert.equal(game().eventsAdjusted, true)
  assert.equal(game().liveEvents.length, 0)
  assert.equal(game().scorerStats.length, 0)
  assert.equal(game().lastScoreEventId, null)
})

test('volleyball points stay inside the current set, closing a set updates the set score and undo restores it', async () => {
  documents.set('games/one', { ...original, esporteNome: 'Vôlei', scoringMode: 'sets', volleyballBestOf: 3 })
  await startGame('one')
  await recordLiveEvent({ gameId: 'one', requestId: 'point-0001', side: 'A', expectedScoreRevision: 0 })
  assert.equal(game().liveScoreA, 0)
  assert.deepEqual(game().currentSet, { a: 1, b: 0 })
  await assert.rejects(finalizeGame({ gameId: 'one', placarA: 2, placarB: 0 }), /set em andamento/)
  await recordLiveEvent({ gameId: 'one', requestId: 'set-000001', kind: 'set', expectedScoreRevision: 1 })
  assert.equal(game().liveScoreA, 1)
  assert.deepEqual(game().setScores, [{ a: 1, b: 0 }])
  await undoLiveEvent({ gameId: 'one', eventId: 'set-000001', expectedScoreRevision: 2 })
  assert.equal(game().liveScoreA, 0)
  assert.deepEqual(game().currentSet, { a: 1, b: 0 })
  await undoLiveEvent({ gameId: 'one', eventId: 'point-0001', expectedScoreRevision: 3 })
  assert.equal(game().currentSet, null)
  await assert.rejects(recordLiveEvent({ gameId: 'one', requestId: 'set-tied01', kind: 'set', expectedScoreRevision: 4 }), /vencedora/)
  await updateLiveScore({ gameId: 'one', placarA: 0, placarB: 0, currentSet: { a: 24, b: 22 }, expectedScoreRevision: 4 })
  assert.deepEqual(game().currentSet, { a: 24, b: 22 })
  await assert.rejects(updateLiveScore({ gameId: 'one', placarA: 0, placarB: 0, currentSet: { a: -1, b: 0 }, expectedScoreRevision: 5 }), /parciais/)
})

test('basketball accepts one, two and three points; chess and finished matches reject point events', async () => {
  documents.set('games/one', { ...original, esporteNome: 'Basquete', scoringMode: 'points' })
  await startGame('one')
  await recordLiveEvent({ gameId: 'one', requestId: 'basket-001', side: 'A', value: 3, expectedScoreRevision: 0 })
  assert.equal(game().liveScoreA, 3)
  await finalizeGame({ gameId: 'one', placarA: 3, placarB: 0 })
  await assert.rejects(recordLiveEvent({ gameId: 'one', requestId: 'basket-002', side: 'B', value: 2, expectedScoreRevision: game().scoreRevision }), /ao vivo/)
  documents.set('games/chess', { ...original, esporteNome: 'Xadrez', scoringMode: 'chess', status: 'encerrado', liveStatus: 'live' })
  await assert.rejects(recordLiveEvent({ gameId: 'chess', requestId: 'chess-0001', side: 'A', expectedScoreRevision: 0 }), /xadrez/)
})

test('starting rejects missing games, unresolved teams and repeated starts', async () => {
  await assert.rejects(startGame('missing'), /não encontrado/)
  documents.set('games/one', { ...original, seedLabelA: '1º Grupo A' })
  await assert.rejects(startGame('one'), /participantes/)
  documents.set('games/one', structuredClone(original))
  await startGame('one')
  await updateLiveScore({ gameId: 'one', placarA: 2, placarB: 1 })
  await assert.rejects(startGame('one'), /já foi iniciado/)
  assert.deepEqual(getMatchScore(game()), [2, 1])
})

test('starting requires a venue, confirmed teams and different vest colors', async () => {
  documents.set('games/one', { ...original, venue: '', vestA: '', attendanceSummary: null })
  await assert.rejects(startGame('one'), /Local definido/)
  documents.set('games/one', { ...original, vestA: 'Azul', vestB: 'Azul' })
  await assert.rejects(startGame('one'), /Coletes definidos/)
  assert.equal(game().status, 'aberto')
  assert.equal(documents.has('operations/liveMatches'), false)
})

test('preparing a game saves attendance and starts atomically; invalid preparation leaves no writes', async () => {
  documents.set('games/one', { ...original, venue: '', vestA: '', vestB: '', attendanceSummary: null })
  documents.set('teams/a', { sportId: 'football', nome: 'Azul' })
  documents.set('teams/a/players/ana', { nome: 'Ana' })
  const preparation = { expectedTeamKey: attendanceTeamKey(game()), venue: 'Quadra 2', vestA: 'Azul', vestB: 'Amarelo', sides: { A: { status: 'present', players: { ana: 'pending' } }, B: { status: 'present' } } }
  await assert.rejects(startGame('one', preparation), /Jogadores conferidos/)
  assert.equal(documents.has('games/one/documents/attendance'), false)
  assert.equal(game().venue, '')
  preparation.sides.A.players.ana = 'present'
  await startGame('one', preparation)
  assert.equal(getMatchState(game()), MATCH_STATE.LIVE)
  assert.equal(game().venue, 'Quadra 2')
  assert.equal(documents.get('games/one/documents/attendance').A.players[0].status, 'present')
  assert.deepEqual(documents.get('operations/liveMatches').gameIds, ['one'])
})

test('active matches reserve their venue and teams until the match is finished', async () => {
  await startGame('one')
  documents.set('games/two', { ...original, timeA: 'Verde', timeB: 'Preto', attendanceSummary: { teamKey: '["football","Verde","Preto"]', teamA: 'present', teamB: 'present' } })
  await assert.rejects(startGame('two'), /Local e equipes disponíveis/)
  documents.set('games/two', { ...documents.get('games/two'), venue: 'Quadra 2' })
  await startGame('two')
  assert.deepEqual(new Set(documents.get('operations/liveMatches').gameIds), new Set(['one', 'two']))
  await finalizeGame({ gameId: 'one', placarA: 1, placarB: 0 })
  documents.set('games/three', { ...original })
  await startGame('three')
  assert(!documents.get('operations/liveMatches').gameIds.includes('one'))
})

test('saving the pre-match conference keeps predictions open and allows basketball and volleyball in one court', async () => {
  documents.set('games/basket', { ...original, sportId: 'basket', esporteNome: 'Basquete', attendanceSummary: null })
  documents.set('games/volley', { ...original, sportId: 'volley', esporteNome: 'Vôlei', attendanceSummary: null })
  await saveGamePreparation('basket', preparationFor('basket', 'Basquete'))
  await saveGamePreparation('volley', preparationFor('volley', 'Vôlei'))
  for (const id of ['basket', 'volley']) {
    assert.equal(isMatchPrepared(game(id)), true)
    assert.equal(getMatchState(game(id)), MATCH_STATE.SCHEDULED)
    assert.equal(canEditPrediction(game(id)), true)
    assert.equal(game(id).startedAt, null)
    assert.equal(JSON.stringify(documents.get(`games/${id}`)).includes('Professor responsável'), false)
  }
  await startPreparedGames(['basket', 'volley'])
  assert.equal(getMatchState(game('basket')), MATCH_STATE.LIVE)
  assert.equal(getMatchState(game('volley')), MATCH_STATE.LIVE)
  assert.equal(game('basket').startedAt.getTime(), game('volley').startedAt.getTime())
  assert.equal(canEditPrediction(game('basket')), false)
})

test('preparation saves the estimated duration and rejects invalid durations without changing the game', async () => {
  await saveGamePreparation('one', { ...preparationFor('one'), durationMinutes: 45 })
  assert.equal(game().durationMinutes, 45)
  assert.equal(getMatchState(game()), MATCH_STATE.SCHEDULED)
  await assert.rejects(saveGamePreparation('one', { ...preparationFor('one'), durationMinutes: 481 }), /duração prevista/)
  assert.equal(game().durationMinutes, 45)
  await startPreparedGames(['one'])
  assert.equal(game().durationMinutes, 45)
})

test('a game can be prepared while its area is occupied but cannot start before the area is free', async () => {
  await startGame('one')
  documents.set('games/next', { ...original, timeA: 'Verde', timeB: 'Preto', attendanceSummary: null })
  const value = { ...preparationFor('next'), venue: 'Quadra 1' }
  await saveGamePreparation('next', value)
  assert.equal(isMatchPrepared(game('next')), true)
  await assert.rejects(startPreparedGames(['next']), /Nenhuma partida foi iniciada/)
  assert.equal(getMatchState(game('next')), MATCH_STATE.SCHEDULED)
  await finalizeGame({ gameId: 'one', placarA: 1, placarB: 0 })
  await startPreparedGames(['next'])
  assert.equal(getMatchState(game('next')), MATCH_STATE.LIVE)
})

test('a conflicting batch starts none of its matches and revised setup requires a new conference', async () => {
  documents.set('games/two', { ...original, timeA: 'Verde', timeB: 'Preto', attendanceSummary: null })
  await saveGamePreparation('one', preparationFor('one', 'Basquete'))
  await saveGamePreparation('two', preparationFor('two', 'Basquete'))
  await assert.rejects(startPreparedGames(['one', 'two']), /Nenhuma partida foi iniciada/)
  assert.equal(getMatchState(game('one')), MATCH_STATE.SCHEDULED)
  assert.equal(getMatchState(game('two')), MATCH_STATE.SCHEDULED)
  assert.equal(documents.has('operations/liveMatches'), false)
  await saveGame({ ...game('one'), venueArea: 'Vôlei' })
  assert.equal(isMatchPrepared(game('one')), false)
  await assert.rejects(startPreparedGames(['one']), /conferência desta partida mudou/)
  await assert.rejects(startPreparedGames([]), /Selecione/)
})

test('changing attendance invalidates readiness while retaining the private match responsible', async () => {
  await saveGamePreparation('one', preparationFor('one', 'Basquete'))
  await saveMatchAttendance({ gameId: 'one', sides: { A: { status: 'present' }, B: { status: 'pending' } } })
  assert.equal(isMatchPrepared(game()), false)
  assert.equal(documents.get('games/one/documents/attendance').responsible, 'Professor responsável')
})

test('live scores validate integers and do not publish a final result', async () => {
  await assert.rejects(updateLiveScore({ gameId: 'one', placarA: 1, placarB: 0 }), /ao vivo/)
  await startGame('one')
  await assert.rejects(updateLiveScore({ gameId: 'one', placarA: -1, placarB: 0 }))
  await assert.rejects(updateLiveScore({ gameId: 'one', placarA: 1.5, placarB: 0 }))
  await updateLiveScore({ gameId: 'one', placarA: 25, placarB: 19 })
  assert.deepEqual(getMatchScore(game()), [25, 19])
  assert.equal(game().placarA, null)
  assert.equal(game().status, 'encerrado')
})

test('finishing publishes the result, ends the live badge and scores predictions', async () => {
  documents.set('users/student', { uid: 'student', nome: 'Aluno', role: 'user', participaRanking: true, pontos: 0 })
  documents.set('predictions/pick', { userId: 'student', gameId: 'one', palpiteA: 2, palpiteB: 1, pontos: 0 })
  await startGame('one')
  assert.equal(documents.get('users/student').pontos, 0)
  await finalizeGame({ gameId: 'one', placarA: 2, placarB: 1, user: { uid: 'master' } })
  assert.equal(getMatchState(game()), MATCH_STATE.FINISHED)
  assert.deepEqual(getMatchScore(game()), [2, 1])
  assert(game().endedAt)
  assert.equal(game().finalizadoPor, 'master')
  assert(documents.get('users/student').pontos > 0)
  assert.equal(documents.get('predictions/pick').acertoExato, true)
  await assert.rejects(updateLiveScore({ gameId: 'one', placarA: 3, placarB: 1 }), /ao vivo/)
  await assert.rejects(startGame('one'), /finalizado/)
})

test('finishing advances the winner to the next knockout match', async () => {
  documents.set('games/final', { ...original, timeA: 'A definir', sourceGameIdA: 'one', seedLabelA: 'Vencedor 1' })
  await startGame('one')
  await finalizeGame({ gameId: 'one', placarA: 1, placarB: 3 })
  assert.equal(documents.get('games/final').timeA, 'Branco')
  assert.equal(documents.get('games/final').seedLabelA, '')
})

test('penalties advance a knockout winner while teacher guesses use the normal-time draw', async () => {
  documents.set('games/one', { ...original, stageType: 'knockout', fase: 'Semifinal' })
  documents.set('games/final', { ...original, stageType: 'knockout', fase: 'Final', timeA: 'A definir', sourceGameIdA: 'one', seedLabelA: 'Vencedor 1' })
  documents.set('users/teacher', { uid: 'teacher', role: 'user', participaRanking: true, pontos: 0 })
  documents.set('predictions/pick', { userId: 'teacher', gameId: 'one', palpiteA: 1, palpiteB: 1 })
  await startGame('one')
  await assert.rejects(finalizeGame({ gameId: 'one', placarA: 1, placarB: 1 }), /Informe o desempate/)
  await assert.rejects(finalizeGame({ gameId: 'one', placarA: 1, placarB: 1, tieBreak: { method: 'penalties', scoreA: 3, scoreB: 3 } }), /vencedora/)
  await updateLiveScore({ gameId: 'one', placarA: 1, placarB: 1, tieBreak: { method: 'penalties', scoreA: 4, scoreB: 3 } })
  await finalizeGame({ gameId: 'one', placarA: 1, placarB: 1 })
  assert.deepEqual(getMatchScore(game()), [1, 1])
  assert.equal(game().tieBreak.scoreA, 4)
  assert.equal(documents.get('games/final').timeA, 'Azul')
  assert.equal(documents.get('predictions/pick').pontos, 4.2)
  await reopenGame('one')
  assert.equal(game().tieBreak, null)
  assert.equal(documents.get('games/final').timeA, 'A definir')
})

test('extra-time scores stay separate and an untied normal result clears an obsolete decider', async () => {
  documents.set('games/one', { ...original, esporteNome: 'Basquete', stageType: 'knockout' })
  documents.set('games/final', { ...original, timeA: 'A definir', sourceGameIdA: 'one', seedLabelA: 'Vencedor 1' })
  await startGame('one')
  await assert.rejects(updateLiveScore({ gameId: 'one', placarA: 70, placarB: 70, tieBreak: { method: 'penalties', scoreA: 3, scoreB: 4 } }), /modalidade/)
  await finalizeGame({ gameId: 'one', placarA: 70, placarB: 70, tieBreak: { method: 'extra-time', scoreA: 8, scoreB: 10 } })
  assert.deepEqual(getMatchScore(game()), [70, 70])
  assert.equal(documents.get('games/final').timeA, 'Branco')
  await reopenGame('one')
  await startGame('one')
  await updateLiveScore({ gameId: 'one', placarA: 70, placarB: 70, tieBreak: { method: 'extra-time', scoreA: 8, scoreB: 10 } })
  await finalizeGame({ gameId: 'one', placarA: 72, placarB: 70 })
  assert.equal(game().tieBreak, null)
  assert.equal(documents.get('games/final').timeA, 'Azul')
})

test('attendance records individual names privately and blocks starting until both teams are confirmed', async () => {
  documents.set('teams/a', { sportId: 'football', nome: 'Azul' })
  documents.set('teams/b', { sportId: 'football', nome: 'Branco' })
  documents.set('teams/a/players/ana', { nome: 'Ana Júlia', capitao: true })
  documents.set('teams/b/players/bruno', { nome: 'Bruno José' })
  await saveMatchAttendance({ gameId: 'one', requireAttendance: true, sides: { A: { status: 'present', players: { ana: 'present' } }, B: { status: 'pending', players: { bruno: 'absent' } } }, user: { uid: 'master' } })
  assert(!JSON.stringify(documents.get('games/one')).includes('Ana Júlia'))
  assert.equal(documents.get('games/one/documents/attendance').A.players[0].status, 'present')
  await assert.rejects(startGame('one'), /equipes presentes/)
  await saveMatchAttendance({ gameId: 'one', requireAttendance: true, sides: { A: { status: 'present', players: { ana: 'present' } }, B: { status: 'present', players: { bruno: 'present' } } } })
  const report = await loadMatchReport(game(), [{ id: 'a', sportId: 'football', nome: 'Azul' }, { id: 'b', sportId: 'football', nome: 'Branco' }])
  assert.equal(report.attendance.B.status, 'present')
  await startGame('one')
  assert.equal(getMatchState(game()), MATCH_STATE.LIVE)
})

test('attendance rejects players from the other team and invalidates confirmation after team changes', async () => {
  documents.set('teams/a', { sportId: 'football', nome: 'Azul' })
  documents.set('teams/a/players/ana', { nome: 'Ana' })
  await assert.rejects(saveMatchAttendance({ gameId: 'one', sides: { A: { players: { notInTeam: 'present' } } } }), /elenco mudou/)
  await assert.rejects(saveMatchAttendance({ gameId: 'one', sides: { A: { status: 'absent', players: { ana: 'present' } } } }), /equipe ausente/)
  await saveMatchAttendance({ gameId: 'one', requireAttendance: true, sides: { A: { status: 'present' }, B: { status: 'present' } } })
  const oldKey = game().attendanceSummary.teamKey
  documents.set('games/one', { ...documents.get('games/one'), timeA: 'Verde' })
  await assert.rejects(startGame('one'), /equipes presentes/)
  await assert.rejects(saveMatchAttendance({ gameId: 'one', expectedTeamKey: oldKey, sides: {} }), /equipes desta partida mudaram/)
})

test('automatic call settings validate and persist disabling and lead time', async () => {
  await assert.rejects(saveBroadcastSettings({ autoCallsEnabled: true, leadMinutes: 2 }))
  await saveBroadcastSettings({ autoCallsEnabled: false, leadMinutes: 15 })
  assert.equal(documents.get('broadcastSettings/tv').autoCallsEnabled, false)
  assert.equal(documents.get('broadcastSettings/tv').leadMinutes, 15)
})

test('reopening is blocked while live and clears the broadcast state after finishing', async () => {
  await startGame('one')
  await assert.rejects(reopenGame('one'), /ao vivo/)
  assert.equal(game().status, 'encerrado')
  await finalizeGame({ gameId: 'one', placarA: 0, placarB: 0 })
  await reopenGame('one')
  assert.equal(getMatchState(game()), MATCH_STATE.SCHEDULED)
  assert.equal(game().placarA, null)
  assert.equal(game().startedAt, null)
  assert.equal(canEditPrediction(game()), true)
})

test('editing from a stale form cannot reopen predictions or overwrite the final score', async () => {
  const staleForm = { id: 'one', ...original, tournamentId: 'cup', tournamentName: 'Copa', rodada: 'Rodada alterada' }
  await startGame('one')
  await saveGame(staleForm)
  assert.equal(game().status, 'encerrado')
  assert.equal(getMatchState(game()), MATCH_STATE.LIVE)
  await finalizeGame({ gameId: 'one', placarA: 4, placarB: 2 })
  await saveGame(staleForm)
  assert.equal(game().status, 'finalizado')
  assert.deepEqual(getMatchScore(game()), [4, 2])
  assert.equal(game().tournamentId, 'cup')
})

test('a stale close-predictions action cannot undo a finished match', async () => {
  await startGame('one')
  await closeGame('one')
  assert.equal(getMatchState(game()), MATCH_STATE.LIVE)
  await finalizeGame({ gameId: 'one', placarA: 2, placarB: 0 })
  await assert.rejects(closeGame('one'), /finalizado/)
  assert.equal(getMatchState(game()), MATCH_STATE.FINISHED)
})

test('postponing a live match preserves its score and resumes without reopening guesses', async () => {
  await startGame('one')
  await updateLiveScore({ gameId: 'one', placarA: 3, placarB: 1 })
  await changeMatchCondition({ gameId: 'one', action: 'postpone', reason: 'Chuva na quadra', user: { uid: 'master' } })
  assert.equal(getMatchState(game()), MATCH_STATE.POSTPONED)
  assert.equal(canEditPrediction(game()), false)
  await assert.rejects(startGame('one'))
  await assert.rejects(finalizeGame({ gameId: 'one', placarA: 3, placarB: 1 }))
  await assert.rejects(reopenGame('one'), /Reagendar/)
  await saveGame({ id: 'one', ...original })
  assert.equal(game().matchCondition, 'postponed')
  await assert.rejects(changeMatchCondition({ gameId: 'one', action: 'reschedule', reason: 'Quadra liberada', dataHora: '2099-11-07T13:00', reopenPredictions: true }), /já começou/)
  await changeMatchCondition({ gameId: 'one', action: 'reschedule', reason: 'Quadra liberada', dataHora: '2099-11-07T13:00' })
  assert.equal(game().previousDate, original.dataHora)
  assert.equal(canEditPrediction(game()), false)
  await startGame('one')
  assert.equal(getMatchState(game()), MATCH_STATE.LIVE)
  assert.deepEqual(getMatchScore(game()), [3, 1])
})

test('cancelled matches can be rescheduled with an explicit valid prediction window', async () => {
  await assert.rejects(changeMatchCondition({ gameId: 'one', action: 'cancel', reason: ' ' }))
  await changeMatchCondition({ gameId: 'one', action: 'cancel', reason: 'Quadra interditada' })
  assert.equal(getMatchState(game()), MATCH_STATE.CANCELLED)
  assert.equal(canEditPrediction(game()), false)
  await assert.rejects(changeMatchCondition({ gameId: 'one', action: 'reschedule', reason: 'Novo local', dataHora: '2099-11-07T10:00', limitePalpites: '2099-11-07T11:00' }))
  await changeMatchCondition({ gameId: 'one', action: 'reschedule', reason: 'Novo local', dataHora: '2099-11-07T10:00', limitePalpites: '2099-11-07T09:30', reopenPredictions: true })
  assert.equal(getMatchState(game()), MATCH_STATE.SCHEDULED)
  assert.equal(canEditPrediction(game()), true)
  assert.equal(game().placarA, null)
})

test('walkovers advance the winner without inventing scores or awarding teacher guesses', async () => {
  documents.set('games/final', { ...original, sourceGameIdA: 'one', timeA: 'A definir', seedLabelA: 'Vencedor 1' })
  documents.set('users/teacher', { uid: 'teacher', nome: 'Professor', role: 'user', participaRanking: true, pontos: 4.2 })
  documents.set('predictions/pick', { userId: 'teacher', gameId: 'one', palpiteA: 3, palpiteB: 0, pontos: 4.2 })
  await changeMatchCondition({ gameId: 'one', action: 'walkover', winnerSide: 'A', reason: 'Equipe adversária ausente' })
  assert.equal(game().status, 'finalizado')
  assert.equal(game().matchCondition, 'walkover')
  assert.equal(game().placarA, null)
  assert.equal(documents.get('games/final').timeA, 'Azul')
  assert.equal(documents.get('predictions/pick').pontos, 0)
  assert.equal(documents.get('users/teacher').pontos, 0)
  const rows = calculateGroupStandings([game()])
  assert.equal(rows[0].pontos, 3)
  assert.equal(rows[0].saldo, 0)
  await reopenGame('one')
  assert.equal(game().matchCondition, 'normal')
  assert.equal(documents.get('games/final').timeA, 'A definir')
  assert.ok(documents.get('games/final').seedLabelA)
})

test('walkover regulation scores require the selected winner and respect the sport rules', async () => {
  await assert.rejects(changeMatchCondition({ gameId: 'one', action: 'walkover', reason: 'Ausência da equipe', winnerSide: '' }))
  await assert.rejects(changeMatchCondition({ gameId: 'one', action: 'walkover', reason: 'Ausência da equipe', winnerSide: 'B', placarA: 3, placarB: 0 }))
  await changeMatchCondition({ gameId: 'one', action: 'walkover', reason: 'Ausência da equipe', winnerSide: 'B', placarA: 0, placarB: 3 })
  assert.deepEqual(getMatchScore(game()), [0, 3])
  assert.equal(calculateGroupStandings([game()])[0].nome, 'Branco')
  assert.equal(calculateGroupStandings([game()])[0].saldo, 3)
  await assert.rejects(changeMatchCondition({ gameId: 'one', action: 'cancel', reason: 'Erro no resultado' }), /Reabra/)
})

test('group walkovers qualify teams and reopening restores the unresolved group slot', async () => {
  documents.set('games/one', { ...original, tournamentId: 'cup', stageType: 'group', groupName: 'Grupo A' })
  documents.set('games/semi', { ...original, tournamentId: 'cup', stageType: 'knockout', timeA: 'A definir', seedLabelA: '1o Grupo A' })
  await changeMatchCondition({ gameId: 'one', action: 'walkover', winnerSide: 'A', reason: 'Ausência da equipe' })
  assert.equal(documents.get('games/semi').timeA, 'Azul')
  assert.equal(documents.get('games/semi').qualifierSeedA, '1o Grupo A')
  await reopenGame('one')
  assert.equal(documents.get('games/semi').seedLabelA, '1o Grupo A')
  assert.equal(documents.get('games/semi').timeA, 'A definir')
})

test('results cannot change when a dependent knockout match has already started', async () => {
  documents.set('games/final', { ...original, sourceGameIdA: 'one', status: 'encerrado', liveStatus: 'live' })
  await assert.rejects(changeMatchCondition({ gameId: 'one', action: 'walkover', winnerSide: 'A', reason: 'Equipe ausente' }), /próxima fase/)
  assert.equal(game().status, 'aberto')
  documents.set('games/one', { ...original, status: 'finalizado', placarA: 1, placarB: 0 })
  await assert.rejects(reopenGame('one'), /próxima fase/)
  assert.equal(game().status, 'finalizado')
})

test('match report notes and rosters stay private and tied to the selected match teams', async () => {
  documents.set('teams/a', { nome: 'Azul', sportId: 'football' })
  documents.set('teams/b', { nome: 'Branco', sportId: 'football' })
  documents.set('teams/a/players/ana', { nome: 'Ana Silva', capitao: true })
  documents.set('teams/b/players/bruno', { nome: 'Bruno Souza' })
  await saveMatchReport('one', { referee: ' Professor José ', notes: 'Observação restrita' }, { uid: 'master' })
  assert.equal(documents.get('games/one').notes, undefined)
  assert.equal(documents.get('games/one/documents/matchReport').referee, 'Professor José')
  const result = await loadMatchReport(game(), [{ id: 'a', nome: 'Azul', sportId: 'football' }, { id: 'b', nome: 'Branco', sportId: 'football' }])
  assert.equal(result.report.notes, 'Observação restrita')
  assert.equal(result.playersA[0].nome, 'Ana Silva')
  assert.equal(result.playersB[0].nome, 'Bruno Souza')
  await assert.rejects(saveMatchReport('missing', {}), /não encontrado/)
  await assert.rejects(saveMatchReport('one', { notes: 'x'.repeat(4001) }))
})

test('player creation, editing and deletion stay within the selected team', async () => {
  documents.set('teams/a', { nome: 'Azul', playerCount: 0 })
  documents.set('teams/b', { nome: 'Branco', playerCount: 0 })
  await savePlayer('a', { nome: 'Ana Silva', posicao: 'Goleira', capitao: true })
  await savePlayer('b', { nome: 'Bruno Silva' })
  const playerPath = [...documents.keys()].find((key) => key.startsWith('teams/a/players/'))
  const id = playerPath.split('/').at(-1)
  assert.equal(documents.get('teams/a').playerCount, 1)
  assert.equal(documents.get('teams/b').playerCount, 1)
  assert.equal(documents.get('teams/a').players, undefined)
  await savePlayer('a', { id, nome: 'Ana Silva', posicao: 'Atacante', capitao: false })
  assert.equal(documents.get(playerPath).posicao, 'Atacante')
  assert.equal('numero' in documents.get(playerPath), false)
  assert.equal(documents.get('teams/a').playerCount, 1)
  await deletePlayer('a', id)
  await deletePlayer('a', id)
  assert.equal(documents.get('teams/a').playerCount, 0)
  assert.equal(documents.get('teams/b').playerCount, 1)
  assert(!documents.has(playerPath))
})

test('players cannot be added to missing teams; deleting a team removes its roster', async () => {
  await assert.rejects(savePlayer('missing', { nome: 'Aluno' }), /não existe/)
  documents.set('teams/a', { nome: 'Azul', playerCount: 0 })
  documents.set('teams/b', { nome: 'Branco', playerCount: 0 })
  await savePlayer('a', { nome: 'Ana Silva' })
  await savePlayer('a', { nome: 'Bruno Silva' })
  await savePlayer('b', { nome: 'Carla Silva' })
  await deleteTeam('a')
  assert(![...documents.keys()].some((key) => key === 'teams/a' || key.startsWith('teams/a/')))
  assert([...documents.keys()].some((key) => key.startsWith('teams/b/players/')))
})

test('bulk roster import skips existing and repeated names without inflating counts', async () => {
  documents.set('teams/a', { nome: 'Azul', playerCount: 0 })
  await savePlayer('a', { nome: 'Ana Silva' })
  const result = await importPlayers('a', [{ nome: 'ANA SILVA' }, { nome: 'Carla Silva' }, { nome: 'Carla Silva' }])
  assert.deepEqual(result, { added: 1, skipped: 2 })
  assert.equal(documents.get('teams/a').playerCount, 2)
  await assert.rejects(importPlayers('missing', [{ nome: 'Aluno Teste' }]), /não existe/)
})

test('chess half points and volleyball set partials survive the live/final lifecycle', async () => {
  documents.set('games/one', { ...original, esporteNome: 'Xadrez' })
  await startGame('one')
  await updateLiveScore({ gameId: 'one', placarA: 0.5, placarB: 0.5 })
  await finalizeGame({ gameId: 'one', placarA: 0.5, placarB: 0.5 })
  assert.deepEqual(getMatchScore(game()), [0.5, 0.5])
  const volleyball = { ...original, sportId: 'v', esporteNome: 'Vôlei' }
  documents.set('games/volley', { ...volleyball, attendanceSummary: { ...volleyball.attendanceSummary, teamKey: attendanceTeamKey(volleyball) } })
  documents.set('sports/v', { nome: 'Vôlei', scoringMode: 'sets', volleyballBestOf: 5 })
  await startGame('volley')
  assert.equal(game('volley').volleyballBestOf, 5)
  await assert.rejects(finalizeGame({ gameId: 'volley', placarA: 2, placarB: 1 }), /vencer 3/)
  const partials = [{ a: 25, b: 20 }, { a: 20, b: 25 }, { a: 25, b: 10 }, { a: 20, b: 25 }, { a: 15, b: 12 }]
  await updateLiveScore({ gameId: 'volley', placarA: 3, placarB: 2, setScores: partials })
  await finalizeGame({ gameId: 'volley', placarA: 3, placarB: 2 })
  assert.equal(game('volley').setScores.length, 5)
})

test('announcements validate public messages and expire automatically by timestamp', async () => {
  await assert.rejects(saveAnnouncement({ text: '' }), /aviso/)
  await assert.rejects(saveAnnouncement({ text: 'Aviso', minutes: -1 }), /validade/)
  await saveAnnouncement({ text: 'Turmas 8º A e 8º B, Quadra 2.', type: 'chamada', minutes: 15 })
  const announcement = [...documents.entries()].find(([path]) => path.startsWith('announcements/'))[1]
  assert.equal(announcement.active, true)
  assert.equal(announcement.type, 'chamada')
  assert(announcement.expiresAt.getTime() > Date.now())
})
