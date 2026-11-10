export const PREDICTION_DRAFT_EVENT = 'bolao:prediction-draft'
export const predictionDraftKey = (userId, gameId) => userId && gameId ? `bolao:prediction-draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(gameId)}` : ''
const stamp = (value) => value?.toMillis?.() ?? value?.getTime?.() ?? value ?? null

export function predictionDraftScope(userId, game, prediction) {
  return JSON.stringify([userId, game.id, game.timeA, game.timeB, game.teamIdA || '', game.teamIdB || '', game.seedLabelA || '', game.seedLabelB || '', game.scoringMode || '', game.volleyballBestOf || '', prediction ? [prediction.palpiteA, prediction.palpiteB, stamp(prediction.updatedAt)] : null])
}

export function parsePredictionDraft(raw, scope) {
  if (!raw) return { draft: null, error: '' }
  if (raw === '!unavailable') return { draft: null, error: 'O navegador não permite recuperar rascunhos. Seu palpite só ficará salvo ao enviar.' }
  try {
    const draft = JSON.parse(raw)
    if (!Number.isFinite(draft.updatedAt) || !['palpiteA', 'palpiteB'].every((field) => typeof draft.value?.[field] === 'string' && /^(?:\d{1,5}(?:\.\d{0,2})?)?$/.test(draft.value[field]))) throw new Error('invalid')
    if (draft.scope !== scope) return { draft: null, error: 'Há um rascunho antigo que não corresponde mais às equipes ou ao palpite enviado. Confira os dados atuais antes de editar.' }
    return { draft, error: '' }
  } catch { return { draft: null, error: 'Não foi possível recuperar o rascunho deste jogo.' } }
}

export function readPredictionDraftRaw(key, storage) {
  if (!key) return null
  try { return (storage ?? globalThis.localStorage).getItem(key) } catch { return '!unavailable' }
}

export function writePredictionDraft(key, value, scope, storage) {
  try {
    if (!key) return 'Entre na sua conta para guardar um rascunho.'
    const target = storage ?? globalThis.localStorage
    if (value) target.setItem(key, JSON.stringify({ scope, value, updatedAt: Date.now() }))
    else target.removeItem(key)
    return ''
  } catch { return 'Não foi possível guardar o rascunho neste navegador. Mantenha a página aberta e envie o palpite para salvá-lo.' }
}

export function clearPredictionDraft(key, expectedRaw, storage) {
  if (!key) return ''
  if (expectedRaw !== undefined && readPredictionDraftRaw(key, storage) !== expectedRaw) return ''
  return writePredictionDraft(key, null, '', storage)
}
