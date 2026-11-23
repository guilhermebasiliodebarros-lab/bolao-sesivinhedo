import { FieldValue } from 'firebase-admin/firestore'
import { canonical } from './domain/ranking.js'

const records = (snapshot) => snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
export function createFirestoreStore(db) {
  const stateRef = (scope) => db.doc(`system/${scope}`)
  return {
    async claim(scope, token) {
      return db.runTransaction(async (tx) => {
        const ref = stateRef(scope), previous = await tx.get(ref)
        const revision = Number(previous.data()?.revision || 0) + 1
        tx.set(ref, { token, revision, status: 'processing', startedAt: FieldValue.serverTimestamp(), error: null }, { merge: true })
        return revision
      })
    },
    async readRankingData() {
      const [users, games, predictions] = await Promise.all(['users', 'games', 'predictions'].map((name) => db.collection(name).get()))
      return { users: records(users), games: records(games), predictions: records(predictions) }
    },
    async commit(scope, token, changes) {
      return db.runTransaction(async (tx) => {
        const state = await tx.get(stateRef(scope))
        if (state.data()?.token !== token) return false
        for (const change of changes) tx.update(db.doc(`${change.collection}/${change.id}`), { ...change.fields, scoreUpdatedAt: FieldValue.serverTimestamp() })
        return true
      })
    },
    async finish(scope, token, summary) {
      return db.runTransaction(async (tx) => {
        const ref = stateRef(scope), state = await tx.get(ref)
        if (state.data()?.token !== token) return false
        tx.update(ref, { status: 'complete', completedRevision: state.data().revision, completedAt: FieldValue.serverTimestamp(), ...summary })
        return true
      })
    },
    async fail(scope, token, error) {
      await db.runTransaction(async (tx) => {
        const ref = stateRef(scope), state = await tx.get(ref)
        if (state.data()?.token === token) tx.update(ref, { status: 'error', error: String(error.code || 'processing-error').slice(0, 100), failedAt: FieldValue.serverTimestamp() })
      })
    },
    async readPredictionData(gameId) {
      const [game, picks] = await Promise.all([db.doc(`games/${gameId}`).get(), db.collection('predictions').where('gameId', '==', gameId).get()])
      const ids = [...new Set(picks.docs.map((item) => item.data().userId).filter((id) => typeof id === 'string' && id && !id.includes('/')))]
      const users = []
      for (let index = 0; index < ids.length; index += 100) users.push(...await db.getAll(...ids.slice(index, index + 100).map((id) => db.doc(`users/${id}`))))
      return { game: game.exists ? { ...game.data(), id: game.id } : null, predictions: records(picks), users: users.filter((item) => item.exists).map((item) => ({ ...item.data(), id: item.id })) }
    },
    async commitStats(scope, token, gameId, counts) {
      return db.runTransaction(async (tx) => {
        const ref = db.doc(`games/${gameId}/public/predictionStats`)
        const [state, game, previous] = await Promise.all([tx.get(stateRef(scope)), tx.get(db.doc(`games/${gameId}`)), tx.get(ref)])
        if (state.data()?.token !== token || !game.exists) return false
        if (canonical(Object.fromEntries(Object.keys(counts).map((key) => [key, previous.data()?.[key] ?? -1]))) !== canonical(counts)) tx.set(ref, { ...counts, updatedAt: FieldValue.serverTimestamp() })
        return true
      })
    },
  }
}
