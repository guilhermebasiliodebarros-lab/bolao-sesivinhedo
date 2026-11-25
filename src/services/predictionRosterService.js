import { collection, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'
import { watchSnapshot } from './realtime.js'
import { trackWrite } from './pendingWrites.js'
import { buildPredictionRoster, usesTopScorer } from '../utils/predictionPlayers.js'
import { canonical } from '../../functions/domain/ranking.js'

export const predictionRosterRef = (teamId) => doc(db, 'teams', teamId, 'public', 'predictionPlayers')
export const predictionRosterFields = (team, players, sourceUpdatedAt = team.updatedAt || null) => ({ ...buildPredictionRoster(team, players), sourceUpdatedAt, updatedAt: serverTimestamp() })

export async function readRosterForWrite(transaction, teamSnapshot) {
  const team = teamSnapshot.data()
  const current = await transaction.get(predictionRosterRef(teamSnapshot.id))
  if (current.exists() && canonical(current.data().sourceUpdatedAt ?? null) === canonical(team.updatedAt ?? null) && Array.isArray(current.data().players)) return current.data().players
  const players = await getDocs(collection(db, 'teams', teamSnapshot.id, 'players'))
  return players.docs.map((item) => ({ ...item.data(), id: item.id }))
}

export async function syncTeamPredictionRoster(teamId) {
  return trackWrite(() => runTransaction(db, async (transaction) => {
    const teamRef = doc(db, 'teams', teamId), target = predictionRosterRef(teamId)
    const [team, previous] = await Promise.all([transaction.get(teamRef), transaction.get(target)])
    if (!team.exists() || !usesTopScorer(team.data())) {
      if (previous.exists()) transaction.delete(target)
      return
    }
    const identity = { ...team.data(), id: teamId }
    const sourceUpdatedAt = identity.updatedAt || null
    const expected = { teamId, teamName: identity.nome || '', sportId: identity.sportId || '', turno: identity.turno || '', sourceUpdatedAt }
    if (previous.exists() && Object.entries(expected).every(([key, value]) => canonical(previous.data()[key] ?? null) === canonical(value))) return
    const players = await getDocs(collection(db, 'teams', teamId, 'players'))
    transaction.set(target, predictionRosterFields(identity, players.docs.map((item) => ({ ...item.data(), id: item.id })), sourceUpdatedAt))
  }))
}

export function startOperatorRosters() {
  let stopped = false, running = false, timer
  const known = new Map(), queue = new Map()
  const drain = async () => {
    if (running || stopped) return
    running = true
    try {
      while (queue.size && !stopped) {
        const selected = [...queue.keys()].slice(0, 4)
        selected.forEach((id) => queue.delete(id))
        const results = await Promise.allSettled(selected.map(syncTeamPredictionRoster))
        results.forEach((result, index) => { if (result.status === 'rejected') known.delete(selected[index]) })
      }
    } finally { running = false }
  }
  const stop = watchSnapshot(collection(db, 'teams'), (snapshot) => {
    if (snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites) return
    const ids = new Set(snapshot.docs.map((item) => item.id))
    for (const id of known.keys()) if (!ids.has(id)) { known.delete(id); queue.set(id, true) }
    snapshot.docs.forEach((item) => {
      const team = item.data()
      if (!usesTopScorer(team)) return
      const key = canonical([team.nome, team.sportId, team.esporteNome, team.turno, team.playerCount, team.updatedAt])
      if (known.get(item.id) !== key) { known.set(item.id, key); queue.set(item.id, true) }
    })
    clearTimeout(timer); timer = setTimeout(() => { void drain() }, 150)
  }, () => {})
  return () => { stopped = true; clearTimeout(timer); stop(); queue.clear() }
}
