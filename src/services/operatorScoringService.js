import { collection, doc, getCountFromServer, getDocFromServer, getDocsFromServer, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { watchSnapshot } from './realtime.js'
import { trackWrite } from './pendingWrites.js'
import { mergeChangedSnapshots, recoverCollection } from '../utils/realtimeChannel.js'
import { operatorScoringKey, operatorStatsKey } from '../utils/operatorScoring.js'
import { canRevealPredictionStats } from '../utils/predictionStats.js'
import { aggregatePredictionStats, approvedParticipant, calculateRankingData, canonical, scoringGame } from '../../functions/domain/ranking.js'
import { processRanking } from '../../functions/processor.js'
import { getGameShift, resolveCompetitionShifts } from '../utils/schoolShifts.js'

const snapshots = new Map()
let activeJob, requested = false
const rows = (snapshot) => snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))
const transaction = (action) => trackWrite(() => runTransaction(db, action))
const hash = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((item) => item.toString(16).padStart(2, '0')).join('')

async function requireOperator() {
  if (!auth?.currentUser || !db) throw new Error('Entre na conta da organização para apurar os palpites.')
  const profile = await getDocFromServer(doc(db, 'users', auth.currentUser.uid))
  return profile.exists() && profile.data().role === 'master'
}

async function readCollection(name) {
  const target = collection(db, name), previous = snapshots.get(name)
  const fresh = await recoverCollection(previous, {
    readAll: () => getDocsFromServer(target),
    readChanged: async (cursor) => mergeChangedSnapshots(await Promise.all((['users', 'predictions'].includes(name) ? ['updatedAt', 'scoreUpdatedAt'] : ['updatedAt']).map((field) => getDocsFromServer(query(target, where(field, '>=', cursor)))))),
    readCount: async () => (await getCountFromServer(target)).data().count,
  })
  if (snapshots.get(name) === previous) snapshots.set(name, fresh)
  return rows(snapshots.get(name) || fresh)
}

export async function readOperatorRankingData() {
  const [users, games, predictions] = await Promise.all(['users', 'games', 'predictions'].map(readCollection))
  return { users, games, predictions }
}

function createOperatorStore() {
  const stateRef = doc(db, 'system', 'scoring')
  let sourceKey
  return {
    claim: (_scope, token) => transaction(async (tx) => {
      const previous = await tx.get(stateRef)
      const revision = (Number(previous.data()?.revision) || 0) + 1
      tx.set(stateRef, { token, revision, status: 'processing', mode: 'operator', startedAt: serverTimestamp(), error: null }, { merge: true })
      return revision
    }),
    readRankingData: async () => {
      const data = await readOperatorRankingData()
      sourceKey = await hash(operatorScoringKey(data))
      return data
    },
    commit: (_scope, token, changes) => transaction(async (tx) => {
      const state = await tx.get(stateRef)
      if (state.data()?.token !== token) return false
      for (const change of changes) tx.update(doc(db, change.collection, change.id), { ...change.fields, scoreUpdatedAt: serverTimestamp() })
      return true
    }),
    finish: async (_scope, token, summary) => {
      const latest = await readOperatorRankingData()
      if (sourceKey !== await hash(operatorScoringKey(latest))) { requested = true; return false }
      return transaction(async (tx) => {
        const state = await tx.get(stateRef)
        if (state.data()?.token !== token) return false
        tx.update(stateRef, { status: 'complete', sourceKey, rulesVersion: 2, completedRevision: state.data().revision, completedAt: serverTimestamp(), ...summary })
        return true
      })
    },
    fail: (_scope, token, error) => transaction(async (tx) => {
      const state = await tx.get(stateRef)
      if (state.data()?.token === token) tx.update(stateRef, { status: 'error', error: String(error.code || 'processing-error').slice(0, 100), failedAt: serverTimestamp() })
    }),
  }
}

async function updatePredictionStats(data) {
  const games = data.games.filter((game) => canRevealPredictionStats(game))
  for (let index = 0; index < games.length; index += 10) {
    await transaction(async (tx) => {
      const selected = games.slice(index, index + 10)
      const targets = selected.map((game) => doc(db, 'games', game.id, 'public', 'predictionStats'))
      const [parents, previous] = await Promise.all([
        Promise.all(selected.map((game) => tx.get(doc(db, 'games', game.id)))),
        Promise.all(targets.map((target) => tx.get(target))),
      ])
      selected.forEach((game, slot) => {
        if (!parents[slot].exists()) return
        const counts = aggregatePredictionStats(game, data.predictions, data.users)
        if (canonical(counts) !== canonical(Object.fromEntries(Object.keys(counts).map((key) => [key, previous[slot].data()?.[key] ?? -1])))) tx.set(targets[slot], { ...counts, updatedAt: serverTimestamp() })
      })
    })
  }
}

export function recalculateWithOperator() {
  requested = true
  if (activeJob) return activeJob
  activeJob = trackWrite(async () => {
    if (!await requireOperator()) { requested = false; return { complete: false, queued: true } }
    let result
    do {
      requested = false
      result = await processRanking(createOperatorStore(), crypto.randomUUID())
      if (result.superseded) {
        for (let attempt = 0; attempt < 48; attempt++) {
          const state = await getDocFromServer(doc(db, 'system', 'scoring'))
          if (state.data()?.status === 'complete') { result = { complete: true, revision: state.data().completedRevision }; break }
          await new Promise((done) => setTimeout(done, 250))
        }
        if (!result.complete) requested = true
      }
    } while (requested)
    await updatePredictionStats(await readOperatorRankingData())
    return result
  }).finally(() => {
    activeJob = null
    if (requested) { requested = false; void recalculateWithOperator().catch(() => {}) }
  })
  return activeJob
}

// Only the organization session runs this; returning to it repairs interrupted work.
export function startOperatorScoring() {
  let stopped = false, timer, lastKey = ''
  const loaded = new Set(), synced = new Set(), data = {}
  const check = () => {
    if (stopped || loaded.size !== 3 || synced.size !== 3) return
    const key = operatorScoringKey(data) + operatorStatsKey(data)
    if (key === lastKey) return
    lastKey = key
    clearTimeout(timer)
    timer = setTimeout(() => { if (!stopped) void recalculateWithOperator().catch(() => { lastKey = ''; if (!stopped) timer = setTimeout(check, 3000) }) }, 200)
  }
  const stops = ['users', 'games', 'predictions'].map((name) => watchSnapshot(collection(db, name), (snapshot) => {
    data[name] = rows(snapshot); loaded.add(name)
    if (!snapshot.metadata?.fromCache && !snapshot.metadata?.hasPendingWrites) snapshots.set(name, snapshot)
    check()
  }, () => { synced.delete(name) }, (connected) => { if (connected) synced.add(name); else synced.delete(name); check() }))
  const interval = setInterval(check, 15000)
  return () => { stopped = true; clearTimeout(timer); clearInterval(interval); stops.forEach((stop) => stop()); snapshots.clear() }
}

export async function prepareOperatorFinalReport(filters = {}) {
  if (!await requireOperator()) throw new Error('Esta ação é exclusiva da organização.')
  if (!filters || typeof filters !== 'object' || Array.isArray(filters) || Object.entries(filters).some(([key, value]) => !['sportId', 'shift', 'tournamentId'].includes(key) || typeof value !== 'string' || value.length > 128) || (filters.shift && !['manha', 'tarde'].includes(filters.shift))) throw new Error('Escolha filtros válidos para o relatório.')
  const [data, teamSnapshot] = await Promise.all([readOperatorRankingData(), getDocsFromServer(collection(db, 'teams'))])
  const teams = rows(teamSnapshot)
  const games = resolveCompetitionShifts(data.games.map(scoringGame).map((game) => ({ ...game, turno: getGameShift(game, teams) }))).filter((game) => (!filters.sportId || game.sportId === filters.sportId) && (!filters.shift || game.turno === filters.shift) && (!filters.tournamentId || game.tournamentId === filters.tournamentId))
  const { totals } = calculateRankingData({ ...data, games })
  const portable = (value) => value?.toDate ? value.toDate().toISOString() : Array.isArray(value) ? value.map(portable) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, portable(item)])) : value
  return { generatedAt: new Date().toISOString(), filters, games: portable(games), teams: teams.map(({ id, nome, sportId, turno, turma, categoria }) => ({ id, nome: nome || '', sportId: sportId || '', turno: turno || '', turma: turma || '', categoria: categoria || '' })), ranking: data.users.filter(approvedParticipant).map((user) => ({ id: user.id, nome: user.nome || user.name || user.displayName || 'Participante', ...totals.get(user.id) })) }
}
