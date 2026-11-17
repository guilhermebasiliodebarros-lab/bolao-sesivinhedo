import { gameMatchesSearch, matchesSport } from './game.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { getGameShift } from './schoolShifts.js'
import { eventDate, nextSchoolDay, schoolDay, SCHOOL_TIMEZONE } from './tvSchedule.js'

export const CALENDAR_STATES = [
  { id: '', label: 'Todos' },
  { id: MATCH_STATE.LIVE, label: 'Ao vivo' },
  { id: MATCH_STATE.SCHEDULED, label: 'Agendados' },
  { id: MATCH_STATE.FINISHED, label: 'Resultados' },
  { id: MATCH_STATE.POSTPONED, label: 'Adiados' },
  { id: MATCH_STATE.CANCELLED, label: 'Cancelados' },
]

export function sortCalendarGames(games) {
  const time = (game) => {
    const value = eventDate(game.dataHora).getTime()
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
  }
  return [...games].sort((a, b) => time(a) - time(b) || String(a.id).localeCompare(String(b.id)))
}

export function filterCalendarGames(games, { sport = '', shift = '', phase = '', search = '', day = '', state = '', venue = '' } = {}, now = new Date()) {
  const selectedDay = day === 'today' ? schoolDay(now) : day === 'tomorrow' ? nextSchoolDay(schoolDay(now)) : day
  return sortCalendarGames(games.filter((game) => matchesSport(game, sport)
    && (!shift || getGameShift(game) === shift)
    && (!phase || game.fase === phase)
    && gameMatchesSearch(game, search)
    && (!selectedDay || schoolDay(game.dataHora) === selectedDay)
    && (!state || getMatchState(game) === state)
    && (!venue || game.venue === venue)))
}

export function formatCalendarDay(day, options = {}) {
  if (!day) return 'Horário a definir'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, weekday: 'long', day: '2-digit', month: 'long', ...options })
    .format(new Date(`${day}T12:00:00-03:00`))
}

export function formatCalendarTime(value) {
  const date = eventDate(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(date)
    : 'A definir'
}

export function groupCalendarDays(games) {
  const groups = new Map()
  sortCalendarGames(games).forEach((game) => {
    const day = schoolDay(game.dataHora)
    const group = groups.get(day) || { id: day || 'undated', nome: formatCalendarDay(day), games: [] }
    group.games.push(game)
    groups.set(day, group)
  })
  return [...groups.values()]
}

export function eventOverview(games, now = new Date()) {
  const today = schoolDay(now)
  return {
    live: sortCalendarGames(games.filter((game) => getMatchState(game) === MATCH_STATE.LIVE)),
    upcoming: sortCalendarGames(games.filter((game) => getMatchState(game) === MATCH_STATE.SCHEDULED && eventDate(game.dataHora) >= now)),
    today: games.filter((game) => schoolDay(game.dataHora) === today && getMatchState(game) !== MATCH_STATE.CANCELLED).length,
    finished: games.filter((game) => getMatchState(game) === MATCH_STATE.FINISHED).length,
  }
}
