import { registerHooks } from 'node:module'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { getMatchScore, getMatchState, MATCH_STATE } from '../src/utils/match.js'

// Exercise the service against an isolated store, never the production Firebase project.
const documents = new Map()
const snapshot = (ref) => ({ id: ref.id, ref, exists: () => documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) })
const apply = (ref, fields) => {
  if (!documents.has(ref.path)) throw new Error('Document not found')
  documents.set(ref.path, { ...documents.get(ref.path), ...structuredClone(fields) })
}
const sdk = {
  collection: (_db, name) => ({ name }),
  doc: (_db, collection, id) => ({ path: `${collection}/${id}`, id }),
  getDoc: async (ref) => snapshot(ref),
  getDocs: async (query) => {
    const docs = [...documents.keys()].filter((path) => path.startsWith(`${query.name}/`)).map((path) => snapshot({ path, id: path.split('/')[1] })).filter((doc) => (query.filters || []).every((filter) => doc.data()[filter.field] === filter.value))
    return { docs, empty: !docs.length, size: docs.length, forEach: (callback) => docs.forEach(callback) }
  },
  query: (collection, ...filters) => ({ ...collection, filters }),
  where: (field, operator, value) => { assert.equal(operator, '=='); return { field, value } },
  runTransaction: async (_db, callback) => {
    const changes = []
    const result = await callback({ get: async (ref) => snapshot(ref), update: (ref, fields) => changes.push([ref, fields]) })
    changes.forEach(([ref, fields]) => apply(ref, fields))
    return result
  },
  updateDoc: async (ref, fields) => apply(ref, fields),
  writeBatch: () => {
    const changes = []
    return { update: (ref, fields) => changes.push([ref, fields]), commit: async () => changes.forEach(([ref, fields]) => apply(ref, fields)) }
  },
  serverTimestamp: () => new Date('2026-11-06T12:00:00Z'),
  Timestamp: { fromDate: (date) => date },
  onSnapshot: () => { throw new Error('Unexpected listener in a service test') },
  setDoc: () => { throw new Error('Unexpected document creation in a service test') },
  deleteDoc: () => { throw new Error('Unexpected document deletion in a service test') },
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
const { normalizeGame, startGame, updateLiveScore, finalizeGame, reopenGame, closeGame, saveGame, canEditPrediction } = await import('../src/services/firestoreService.js')
const original = {
  sportId: 'football', esporteNome: 'Futebol', fase: 'Fase de grupos', rodada: 'Rodada 1',
  timeA: 'Azul', timeB: 'Branco', status: 'aberto', dataHora: '2099-11-06T12:00', limitePalpites: '2099-11-06T11:00',
}
const game = (id = 'one') => normalizeGame(id, documents.get(`games/${id}`))
beforeEach(() => { documents.clear(); documents.set('games/one', structuredClone(original)) })

test('existing games remain scheduled; unknown final scores are never invented', () => {
  assert.equal(getMatchState(game()), MATCH_STATE.SCHEDULED)
  assert.equal(getMatchState({ status: 'finalizado', liveStatus: 'live' }), MATCH_STATE.FINISHED)
  assert.equal(getMatchState({ status: 'finished', liveStatus: 'live' }), MATCH_STATE.FINISHED)
  assert.deepEqual(getMatchScore({ status: 'finalizado' }), ['–', '–'])
})

test('starting closes predictions and supports simultaneous matches', async () => {
  documents.set('games/two', { ...original, sportId: 'volleyball', esporteNome: 'Vôlei' })
  await Promise.all([startGame('one'), startGame('two')])
  for (const id of ['one', 'two']) {
    assert.equal(getMatchState(game(id)), MATCH_STATE.LIVE)
    assert.equal(game(id).status, 'encerrado')
    assert.equal(canEditPrediction(game(id)), false)
    assert(game(id).startedAt)
  }
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
