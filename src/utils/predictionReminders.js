import { automaticPredictionDeadline } from './predictionDeadline.js'
import { getMatchCondition, getMatchState, MATCH_STATE } from './match.js'

export const reminderPreferenceKey = (uid) => `bolao:reminders:v1:${encodeURIComponent(uid)}`
export const reminderId = (game) => `${game.id}:${automaticPredictionDeadline(game)?.getTime()}`
export function reminderCandidates(games, predictions, now, leadMinutes) {
  const sent = new Set(predictions.map((item) => item.gameId))
  return games.filter((game) => {
    const remaining = automaticPredictionDeadline(game)?.getTime() - Number(now)
    return game.status === 'aberto' && !game.deletionPending && !game.startedAt && getMatchState(game) === MATCH_STATE.SCHEDULED && getMatchCondition(game) === 'normal' && !sent.has(game.id) && remaining > 0 && remaining <= leadMinutes * 60000
  }).sort((a, b) => automaticPredictionDeadline(a) - automaticPredictionDeadline(b))
}

// Call under navigator.locks when available so two tabs cannot claim the same reminder.
export function claimReminder(uid, game, now, storage, session = new Set()) {
  const id = reminderId(game)
  if (session.has(id)) return false
  const key = `${reminderPreferenceKey(uid)}:seen`
  try {
    const target = storage ?? globalThis.localStorage
    let seen
    try { seen = JSON.parse(target.getItem(key) || '{}') } catch { seen = {} }
    if (!seen || typeof seen !== 'object' || Array.isArray(seen)) seen = {}
    if (seen[id]) { session.add(id); return false }
    const recent = Object.entries(seen).filter(([, time]) => Number.isFinite(time) && time > Number(now) - 30 * 86400000).slice(-999)
    target.setItem(key, JSON.stringify({ ...Object.fromEntries(recent), [id]: Number(now) }))
  } catch { /* In-app reminders still work when browser storage is unavailable. */ }
  session.add(id)
  return true
}
