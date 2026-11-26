import { toDate } from './format.js'

export const TV_ANNOUNCEMENT_MS = 30_000
export const TV_SIREN_MS = 5_000
export const TV_ANNOUNCEMENT_TYPES = { aviso: 'Aviso da comissão', chamada: 'Chamada de equipes', atraso: 'Alteração na programação' }

export function activeTVAnnouncement(message, now = Date.now()) {
  if (!message?.id || !Object.hasOwn(TV_ANNOUNCEMENT_TYPES, message.type) || typeof message.text !== 'string' || !message.text.trim()) return null
  const publishedAt = toDate(message.publishedAt).getTime()
  const expiresAt = publishedAt + TV_ANNOUNCEMENT_MS
  if (!Number.isFinite(publishedAt) || publishedAt > now + TV_SIREN_MS || expiresAt <= now) return null
  return { id: message.id, type: message.type, text: message.text, publishedAt, expiresAt }
}
