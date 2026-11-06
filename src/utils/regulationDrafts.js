import { REGULATION_MAX_LENGTH, REGULATION_SECTIONS } from './regulations.js'

const draftKey = (userId, sportId) => {
  if (!userId || !sportId) throw new Error('Entre na sua conta para guardar o rascunho.')
  return `bolao-sesivinhedo:regulation-draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(sportId)}`
}

export function readRegulationDraft(userId, sportId, storage) {
  try {
    const raw = (storage || globalThis.localStorage).getItem(draftKey(userId, sportId))
    if (!raw) return { draft: null, error: '' }
    const draft = JSON.parse(raw)
    if (!Number.isInteger(draft.revision) || draft.revision < 0 || !Number.isFinite(draft.updatedAt) || !REGULATION_SECTIONS.every(({ id }) => typeof draft.value?.[id] === 'string' && draft.value[id].length <= REGULATION_MAX_LENGTH)) throw new Error('invalid')
    return { draft: { revision: draft.revision, updatedAt: draft.updatedAt, value: Object.fromEntries(REGULATION_SECTIONS.map(({ id }) => [id, draft.value[id]])) }, error: '' }
  } catch {
    return { draft: null, error: 'Não foi possível recuperar o rascunho deste navegador.' }
  }
}

export function writeRegulationDraft(userId, sportId, draft, storage) {
  try {
    const target = storage || globalThis.localStorage
    const key = draftKey(userId, sportId)
    if (draft) target.setItem(key, JSON.stringify(draft))
    else target.removeItem(key)
    return ''
  } catch {
    return 'O navegador não conseguiu guardar o rascunho. Mantenha esta página aberta e salve o regulamento para preservar o texto.'
  }
}
