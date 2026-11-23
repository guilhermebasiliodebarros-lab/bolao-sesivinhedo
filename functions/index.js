import { randomUUID } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { createFirestoreStore } from './firestoreStore.js'
import { processPredictionStats, processRanking } from './processor.js'
import { approvedParticipant, calculateRankingData, gameScoringInput, gameStatsInput, predictionInput, profileInput, scoringGame } from './domain/ranking.js'
import { getGameShift, resolveCompetitionShifts } from './domain/schoolShifts.js'

initializeApp()
const db = getFirestore(), store = createFirestoreStore(db)
const region = 'southamerica-east1'
const trigger = { region, retry: true, timeoutSeconds: 300, memory: '512MiB', maxInstances: 3, concurrency: 1 }
const raw = (snapshot) => snapshot?.exists ? snapshot.data() : null
const runRanking = () => processRanking(store, randomUUID())
const runStats = (id) => typeof id === 'string' && id && !id.includes('/') ? processPredictionStats(store, id, randomUUID()) : Promise.resolve()
async function requireMaster(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Entre na conta da organização.')
  if ((await db.doc(`users/${request.auth.uid}`).get()).data()?.role !== 'master') throw new HttpsError('permission-denied', 'Esta ação é exclusiva da organização.')
}
async function allStats() {
  const games = await db.collection('games').get()
  for (let index = 0; index < games.docs.length; index += 5) await Promise.all(games.docs.slice(index, index + 5).map((game) => runStats(game.id)))
}

export const onGameScoringChange = onDocumentWritten({ ...trigger, document: 'games/{gameId}' }, async (event) => {
  const before = raw(event.data.before), after = raw(event.data.after)
  const tasks = []
  if (gameStatsInput(before) !== gameStatsInput(after)) tasks.push(runStats(event.params.gameId))
  if (gameScoringInput(before) !== gameScoringInput(after)) tasks.push(runRanking())
  await Promise.all(tasks)
})

export const onPredictionChange = onDocumentWritten({ ...trigger, document: 'predictions/{predictionId}' }, async (event) => {
  const before = raw(event.data.before), after = raw(event.data.after)
  if (predictionInput(before) === predictionInput(after)) return
  const ids = [...new Set([before?.gameId, after?.gameId].filter((id) => typeof id === 'string' && id && !id.includes('/') && id.length < 256))]
  await Promise.all(ids.map(runStats))
  const games = await Promise.all(ids.map((id) => db.doc(`games/${id}`).get()))
  if (games.some((game) => ['finalizado', 'finished'].includes(game.data()?.status))) await runRanking()
})

export const onParticipantApprovalChange = onDocumentWritten({ ...trigger, document: 'users/{userId}' }, async (event) => {
  if (profileInput(raw(event.data.before)) === profileInput(raw(event.data.after))) return
  if (approvedParticipant(raw(event.data.before)) === approvedParticipant(raw(event.data.after))) return
  await Promise.all([runRanking(), allStats()])
})

export const recalculateRanking = onCall({ region, timeoutSeconds: 120, memory: '512MiB', maxInstances: 3 }, async (request) => {
  await requireMaster(request)
  const result = await runRanking()
  if (result.complete) return result
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = (await db.doc('system/scoring').get()).data()
    if (state?.status === 'complete' && state.completedRevision >= result.revision) return { complete: true, revision: state.completedRevision }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return { complete: false, queued: true }
})

const reportFields = ['sportId', 'esporteNome', 'scoringMode', 'timeA', 'timeB', 'teamIdA', 'teamIdB', 'turmaA', 'turmaB', 'turno', 'status', 'liveStatus', 'matchCondition', 'walkoverWinner', 'placarA', 'placarB', 'setScores', 'tieBreak', 'fase', 'rodada', 'stageType', 'groupName', 'tournamentId', 'tournamentName', 'sourceGameIdA', 'sourceGameIdB', 'sourceOutcomeA', 'sourceOutcomeB', 'seedLabelA', 'seedLabelB', 'placement', 'venue', 'venueArea', 'dataHora', 'scorerStats', 'eventsAdjusted', 'publicCardEvents', 'startedAt', 'endedAt', 'winPoints', 'drawPoints', 'lossPoints']
const portable = (value) => value?.toDate ? value.toDate().toISOString() : Array.isArray(value) ? value.map(portable) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, portable(item)])) : value
export const prepareFinalReport = onCall({ region, timeoutSeconds: 120, memory: '512MiB', maxInstances: 2 }, async (request) => {
  await requireMaster(request)
  const filters = request.data || {}
  if (!filters || typeof filters !== 'object' || Array.isArray(filters) || Object.entries(filters).some(([key, value]) => !['sportId', 'shift', 'tournamentId'].includes(key) || typeof value !== 'string' || value.length > 128) || (filters.shift && !['manha', 'tarde'].includes(filters.shift))) throw new HttpsError('invalid-argument', 'Escolha filtros válidos para o relatório.')
  const [data, teamSnapshot] = await Promise.all([store.readRankingData(), db.collection('teams').get()])
  const teams = teamSnapshot.docs.map((item) => ({ ...item.data(), id: item.id }))
  const games = resolveCompetitionShifts(data.games.map(scoringGame).map((game) => ({ ...game, turno: getGameShift(game, teams) }))).filter((game) => (!filters.sportId || game.sportId === filters.sportId) && (!filters.shift || game.turno === filters.shift) && (!filters.tournamentId || game.tournamentId === filters.tournamentId))
  const { totals } = calculateRankingData({ ...data, games })
  return {
    generatedAt: new Date().toISOString(), filters,
    games: games.map((game) => portable(Object.fromEntries(['id', ...reportFields].filter((key) => game[key] !== undefined).map((key) => [key, game[key]])))),
    teams: teams.map((item) => ({ id: item.id, nome: item.nome || '', sportId: item.sportId || '', turno: item.turno || '', turma: item.turma || '', categoria: item.categoria || '' })),
    ranking: data.users.filter(approvedParticipant).map((user) => ({ id: user.id, nome: user.nome || user.name || user.displayName || 'Participante', ...totals.get(user.id) })),
  }
})
