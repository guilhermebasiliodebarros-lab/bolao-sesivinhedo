import { eventDate } from './tvSchedule.js'
import { getMatchCondition } from './match.js'

const text = (value) => String(value || '').trim()
const dateTime = (game) => {
  const date = eventDate(game.dataHora || game.dateTime)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}
const schedule = (game) => ({ dateTime: dateTime(game), venue: text(game.venue), venueArea: text(game.venueArea), condition: getMatchCondition(game) })

export function buildScheduleChange(before, after) {
  if (!before || !after) return null
  const previous = schedule(before), current = schedule(after)
  const fields = []
  if (previous.dateTime !== current.dateTime) fields.push('time')
  if (previous.venue.toLocaleLowerCase('pt-BR') !== current.venue.toLocaleLowerCase('pt-BR') || previous.venueArea.toLocaleLowerCase('pt-BR') !== current.venueArea.toLocaleLowerCase('pt-BR')) fields.push('venue')
  if (previous.condition !== current.condition) fields.push('condition')
  if (!fields.length) return null
  return {
    gameId: after.id || before.id,
    esporteNome: text(after.esporteNome || before.esporteNome),
    timeA: text(after.timeA || before.timeA), timeB: text(after.timeB || before.timeB),
    fields, previous, current,
  }
}

export function unreadScheduleNotices(notices, readIds = []) {
  const read = new Set(readIds)
  return notices.filter((notice) => !read.has(notice.id))
}

export function mergeReadNoticeIds(previous, current) {
  return [...new Set([...current, ...previous])].filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 128 && !id.includes('/')).slice(0, 100)
}

export function normalizeScheduleNotice(id, value) {
  const changes = (Array.isArray(value?.changes) ? value.changes : []).filter((change) => change && typeof change.gameId === 'string' && Array.isArray(change.fields)).map((change) => ({
    gameId: change.gameId, timeA: text(change.timeA), timeB: text(change.timeB), esporteNome: text(change.esporteNome),
    fields: change.fields.filter((field) => ['time', 'venue', 'condition'].includes(field)),
    previous: { dateTime: text(change.previous?.dateTime), venue: text(change.previous?.venue), venueArea: text(change.previous?.venueArea), condition: text(change.previous?.condition) },
    current: { dateTime: text(change.current?.dateTime), venue: text(change.current?.venue), venueArea: text(change.current?.venueArea), condition: text(change.current?.condition) },
  })).filter((change) => change.fields.length)
  return changes.length ? { id, changes, createdAt: value.createdAt || null } : null
}

export function scheduleConditionLabel(value) {
  return { normal: 'Programação normal', postponed: 'Adiado', cancelled: 'Cancelado', walkover: 'W.O.' }[value] || 'Programação normal'
}

export function formatNoticeDate(value) {
  const date = eventDate(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(date) : 'Data a definir'
}
