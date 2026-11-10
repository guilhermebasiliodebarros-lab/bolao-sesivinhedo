import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { clearPredictionDraft, parsePredictionDraft, PREDICTION_DRAFT_EVENT, predictionDraftKey, predictionDraftScope, readPredictionDraftRaw, writePredictionDraft } from '../utils/predictionDrafts.js'

const subscribe = (callback) => {
  window.addEventListener('storage', callback)
  window.addEventListener(PREDICTION_DRAFT_EVENT, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(PREDICTION_DRAFT_EVENT, callback) }
}
const announce = () => window.dispatchEvent(new Event(PREDICTION_DRAFT_EVENT))

export default function usePredictionDraft({ userId, game, prediction, editable }) {
  const key = predictionDraftKey(userId, game.id)
  const scope = predictionDraftScope(userId, game, prediction)
  const getSnapshot = useCallback(() => readPredictionDraftRaw(key), [key])
  const raw = useSyncExternalStore(subscribe, getSnapshot)
  const recovered = parsePredictionDraft(raw, scope)
  const [session, setSession] = useState(null)
  const fallback = session?.scope === scope ? session : null
  const value = editable ? fallback?.value || recovered.draft?.value || null : null

  useEffect(() => {
    if (!editable && key && raw && raw !== '!unavailable') { clearPredictionDraft(key, raw); announce() }
  }, [editable, key, raw])

  const updateValues = (fields) => {
    const next = { palpiteA: String(value?.palpiteA ?? prediction?.palpiteA ?? ''), palpiteB: String(value?.palpiteB ?? prediction?.palpiteB ?? '') }
    for (const field of ['palpiteA', 'palpiteB']) if (Object.hasOwn(fields, field)) next[field] = String(fields[field])
    const error = writePredictionDraft(key, next, scope)
    setSession({ scope, value: error ? next : null, error })
    announce()
  }
  const clear = (expected = raw) => {
    const error = clearPredictionDraft(key, expected)
    setSession({ scope, value: null, error })
    announce()
  }
  return { value, update: (field, input) => updateValues({ [field]: input }), updateValues, clear, raw, hasDraft: Boolean(value), error: fallback?.error || recovered.error }
}
