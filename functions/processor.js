import { aggregatePredictionStats, calculateRankingData } from './domain/ranking.js'

export async function processRanking(store, token) {
  const revision = await store.claim('scoring', token)
  try {
    const data = await store.readRankingData()
    const plan = calculateRankingData(data)
    const changes = [...plan.predictionUpdates.map((item) => ({ ...item, collection: 'predictions' })), ...plan.userUpdates.map((item) => ({ ...item, collection: 'users' }))]
    for (let index = 0; index < changes.length; index += 300) if (!await store.commit('scoring', token, changes.slice(index, index + 300))) return { complete: false, revision, superseded: true }
    const complete = await store.finish('scoring', token, { predictions: data.predictions.length, participants: data.users.length, changed: changes.length })
    return { complete, revision, changed: changes.length }
  } catch (error) { await store.fail('scoring', token, error); throw error }
}

export async function processPredictionStats(store, gameId, token) {
  const scope = `stats-${gameId}`
  await store.claim(scope, token)
  try {
    const { game, predictions, users } = await store.readPredictionData(gameId)
    if (!game) { await store.finish(scope, token, {}); return }
    const counts = aggregatePredictionStats(game, predictions, users)
    await store.commitStats(scope, token, gameId, counts)
    await store.finish(scope, token, { total: counts.total })
  } catch (error) { await store.fail(scope, token, error); throw error }
}
