import { eventDate, schoolDay } from './tvSchedule.js'
import { getMatchCondition, getMatchState, MATCH_STATE } from './match.js'
import { findScheduleConflicts } from './scheduleConflicts.js'
import { venueKey } from './matchVenue.js'

export function calendarFingerprint(game) {
  return JSON.stringify(['id', 'dataHora', 'venue', 'venueArea', 'durationMinutes', 'status', 'liveStatus', 'matchCondition', 'startedAt', 'scoreRevision', 'timeA', 'timeB', 'teamIdA', 'teamIdB', 'turmaA', 'turmaB', 'seedLabelA', 'seedLabelB', 'sourceGameIdA', 'sourceGameIdB', 'deletionPending'].map((field) => game?.[field]?.toMillis?.() ?? game?.[field] ?? null))
}

export function canScheduleGame(game) {
  return Boolean(game && !game.deletionPending && !game.startedAt && getMatchState(game) === MATCH_STATE.SCHEDULED && getMatchCondition(game) === 'normal')
}

export function calendarCandidate(game, change) {
  if (!canScheduleGame(game)) throw new Error('Só é possível organizar partidas que ainda não começaram e não estão canceladas, adiadas ou em exclusão.')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(change.dataHora || '') || !Number.isFinite(eventDate(change.dataHora).getTime())) throw new Error('Escolha um dia e horário válidos.')
  const durationMinutes = Number(change.durationMinutes)
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) throw new Error('Informe uma duração entre 1 e 480 minutos.')
  return { ...game, dataHora: change.dataHora, durationMinutes, venue: String(change.venue || '').trim().slice(0, 80), venueArea: String(change.venueArea || '').trim().slice(0, 80) }
}

export function calendarConflicts(candidate, games, teams) {
  const conflicts = findScheduleConflicts(candidate, games, teams)
  for (const id of new Set([candidate.sourceGameIdA, candidate.sourceGameIdB].filter(Boolean))) {
    const parent = games.find((game) => game.id === id)
    const parentEnd = eventDate(parent?.dataHora).getTime() + Number(parent?.durationMinutes || 30) * 60000
    if (!parent || !Number.isFinite(parentEnd) || eventDate(candidate.dataHora).getTime() < parentEnd) {
      const existing = conflicts.find((item) => item.game.id === id)
      if (existing) existing.reasons.push('Fase anterior sem horário ou ainda em andamento')
      else conflicts.push({ game: parent || { id, timeA: 'Fase anterior', timeB: 'a definir' }, reasons: ['Fase anterior sem horário ou ainda em andamento'] })
    }
  }
  return conflicts
}

export const calendarConflictSignature = (conflicts) => JSON.stringify(conflicts.map(({ game, reasons }) => [calendarFingerprint(game), [...reasons].sort()]).sort((a, b) => a[0].localeCompare(b[0])))

export function calendarColumns(games, extra = []) {
  const venues = new Map([['', '']])
  for (const name of [...games.map((game) => game.venue), ...extra]) if (String(name || '').trim()) venues.set(venueKey(name), String(name).trim())
  return [...venues.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function calendarSlots(start, finish, step) {
  const minutes = (value) => Number(value?.slice(0, 2)) * 60 + Number(value?.slice(3, 5))
  const from = minutes(start), to = minutes(finish), spacing = Number(step)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || ![15, 30, 60].includes(spacing)) return []
  return Array.from({ length: Math.ceil((to - from) / spacing) }, (_, index) => {
    const total = from + index * spacing
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })
}

export function calendarSlotGames(games, day, time, step, venue) {
  const start = eventDate(`${day}T${time}`).getTime(), end = start + Number(step) * 60000
  return games.filter((game) => schoolDay(game.dataHora) === day && venueKey(game.venue) === venueKey(venue) && eventDate(game.dataHora).getTime() >= start && eventDate(game.dataHora).getTime() < end)
}
