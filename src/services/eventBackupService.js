import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { trackWrite } from './pendingWrites.js'
import { queueScheduleNotice, recalculateScores } from './firestoreService.js'
import { BACKUP_COLLECTIONS, canonicalBackupValue, createEventBackup, decodeBackupValue, encodeBackupValue, eventRestoreChunks, planEventRestore, validateEventBackup } from '../utils/eventBackup.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import { matchClockValue } from '../utils/matchClock.js'

export const backupProjectId = () => db?.app?.options?.projectId || ''

async function requireBackupMaster() {
  if (!db || !auth?.currentUser?.uid) throw new Error('Entre na conta da organização para acessar os backups.')
  const profile = await getDocFromServer(doc(db, 'users', auth.currentUser.uid))
  if (!profile.exists() || profile.data().role !== 'master') throw new Error('Somente a organização pode exportar e recuperar dados.')
}

async function mapLimited(items, action) {
  const results = []
  for (let index = 0; index < items.length; index += 6) results.push(...await Promise.all(items.slice(index, index + 6).map(action)))
  return results.flat()
}

async function readEventRecords(verifyParents = false) {
  const root = await mapLimited(BACKUP_COLLECTIONS, async (name) => {
    const result = await getDocsFromServer(collection(db, name))
    return result.docs.map((item) => ({ path: `${name}/${item.id}`, data: item.data() }))
  })
  if (root.some(({ path, data }) => path.startsWith('games/') && data.deletionPending)) throw new Error('Aguarde a exclusão de partidas terminar antes de criar ou recuperar um backup.')
  const nested = root.flatMap(({ path }) => path.startsWith('teams/') ? [`${path}/players`] : path.startsWith('games/') ? [`${path}/events`, `${path}/documents`] : [])
  const children = await mapLimited(nested, async (path) => {
    const result = await getDocsFromServer(collection(db, ...path.split('/')))
    return result.docs.map((item) => ({ path: `${path}/${item.id}`, data: item.data() }))
  })
  if (verifyParents) {
    for (const name of ['games', 'teams']) {
      const current = await getDocsFromServer(collection(db, name))
      const previous = new Map(root.filter((record) => record.path.startsWith(`${name}/`)).map((record) => [record.path, canonicalBackupValue(encodeBackupValue(record.data))]))
      if (current.docs.length !== previous.size || current.docs.some((item) => previous.get(`${name}/${item.id}`) !== canonicalBackupValue(encodeBackupValue(item.data())))) throw new Error('Uma partida ou equipe mudou durante a cópia. Tente gerar o backup novamente para guardar os dados completos.')
    }
  }
  return [...root, ...children]
}

export async function exportEventBackup() {
  await requireBackupMaster()
  const records = await readEventRecords(true)
  return createEventBackup(backupProjectId(), records)
}

export function downloadEventBackup(backup, prefix = 'interclasse-backup') {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-${backup.createdAt.replace(/[:.]/g, '-')}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function ensureRestoreIdle(records) {
  if (records.some(({ path, data }) => path.startsWith('games/') && path.split('/').length === 2 && getMatchState(data) === MATCH_STATE.LIVE)) throw new Error('Encerre as partidas ao vivo antes de recuperar um backup. A exportação continua disponível durante os jogos.')
}

export async function previewEventRestore(backup, mode = 'missing') {
  await requireBackupMaster()
  await validateEventBackup(backup, backupProjectId())
  const records = await readEventRecords()
  ensureRestoreIdle(records)
  return planEventRestore(backup, records, mode)
}

export async function finalizeEventRecovery(backup) {
  await requireBackupMaster()
  await validateEventBackup(backup, backupProjectId())
  const teams = backup.documents.filter((record) => record.path.startsWith('teams/') && record.path.split('/').length === 2)
  await mapLimited(teams, (team) => trackWrite(() => runTransaction(db, async (transaction) => {
    const ref = doc(db, ...team.path.split('/'))
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) return
    const roster = await getDocsFromServer(collection(db, ...team.path.split('/'), 'players'))
    if (Number(snapshot.data().playerCount) !== roster.size) transaction.update(ref, { playerCount: roster.size, updatedAt: serverTimestamp() })
  })))
  await recalculateScores()
}

function restorationData(change, snapshot, backupAt) {
  const data = decodeBackupValue(change.data, (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds))
  if (change.path.startsWith('predictions/')) {
    const previous = snapshot.exists() ? snapshot.data() : {}
    data.pontos = previous.pontos ?? 0
    data.acertoExato = previous.acertoExato ?? false
    data.acertoResultado = previous.acertoResultado ?? false
    if (previous.scoreUpdatedAt) data.scoreUpdatedAt = previous.scoreUpdatedAt
    else delete data.scoreUpdatedAt
  }
  if (change.path.startsWith('games/') && change.path.split('/').length === 2) {
    data.scoreRevision = Math.max(Number(data.scoreRevision) || 0, Number(snapshot.exists() && snapshot.data().scoreRevision) || 0) + 1
    if (getMatchState(data) === MATCH_STATE.LIVE) data.clock = { ...(data.clock || {}), elapsedMs: matchClockValue(data, new Date(backupAt)).elapsedMs, runningSince: null, revision: (Number(data.clock?.revision) || 0) + 1 }
  }
  if (change.path.startsWith('sports/')) data.regulationRevision = Math.max(Number(data.regulationRevision) || 0, Number(snapshot.exists() && snapshot.data().regulationRevision) || 0) + 1
  if (typeof data.revision === 'number') data.revision = Math.max(data.revision, Number(snapshot.exists() && snapshot.data().revision) || 0) + 1
  return data
}

export async function restoreEventBackup(backup, reviewedPlan, onProgress = () => {}) {
  await requireBackupMaster()
  await validateEventBackup(backup, backupProjectId())
  if (!reviewedPlan || reviewedPlan.backupChecksum !== backup.checksum || !['missing', 'replace'].includes(reviewedPlan.mode)) throw new Error('Confira a prévia deste arquivo antes de recuperar os dados.')
  const records = await readEventRecords()
  ensureRestoreIdle(records)
  const latestPlan = planEventRestore(backup, records, reviewedPlan.mode)
  if (canonicalBackupValue(latestPlan) !== canonicalBackupValue(reviewedPlan)) throw new Error('Os dados mudaram desde a prévia. Confira novamente o arquivo antes de restaurar.')
  // Parents must exist in a committed write before the security rules allow their private subcollections.
  const stages = [latestPlan.changes.filter((item) => item.path.split('/').length === 2), latestPlan.changes.filter((item) => item.path.split('/').length === 4)]
  let completed = 0
  let recordsComplete = false
  onProgress({ completed, total: latestPlan.changes.length })
  try {
    for (const stage of stages) for (const chunk of eventRestoreChunks(stage)) {
      await trackWrite(() => runTransaction(db, async (transaction) => {
        const parentPaths = [...new Set(chunk.filter((change) => change.path.split('/').length === 4).map((change) => change.path.split('/').slice(0, 2).join('/')))]
        const [snapshots, parents] = await Promise.all([
          Promise.all(chunk.map((change) => transaction.get(doc(db, ...change.path.split('/'))))),
          Promise.all(parentPaths.map((path) => transaction.get(doc(db, ...path.split('/'))))),
        ])
        if (parents.some((parent) => !parent.exists() || parent.data().deletionPending)) throw new Error('Uma equipe ou partida foi removida durante a recuperação. Confira uma nova prévia.')
        snapshots.forEach((snapshot, itemIndex) => {
          const actual = snapshot.exists() ? canonicalBackupValue(encodeBackupValue(snapshot.data())) : null
          if (actual !== chunk[itemIndex].before) throw new Error('Um registro foi alterado em outra sessão. Confira uma nova prévia para continuar.')
        })
        const pairs = []
        chunk.forEach((change, itemIndex) => {
          const data = restorationData(change, snapshots[itemIndex], backup.createdAt)
          transaction.set(doc(db, ...change.path.split('/')), data)
          if (change.path.startsWith('games/') && change.path.split('/').length === 2 && snapshots[itemIndex].exists()) pairs.push([{ ...snapshots[itemIndex].data(), id: snapshots[itemIndex].id }, { ...data, id: snapshots[itemIndex].id }])
        })
        queueScheduleNotice(transaction, pairs)
      }))
      completed += chunk.length
      onProgress({ completed, total: latestPlan.changes.length })
    }
    recordsComplete = true
    await finalizeEventRecovery(backup)
    return { ...latestPlan.counts, completed }
  } catch (error) {
    const failure = new Error(`${completed} de ${latestPlan.changes.length} registro(s) recuperado(s). ${error.message} ${recordsComplete ? 'Conclua a conferência dos totais quando a conexão voltar.' : 'Confira uma nova prévia com a mesma opção para continuar.'}`, { cause: error })
    failure.needsFinalization = recordsComplete
    throw failure
  }
}
