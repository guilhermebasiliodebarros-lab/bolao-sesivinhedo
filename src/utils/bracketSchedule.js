import { normalizeFilterText } from './game.js'
import { getGameShift, getTeamShift } from './schoolShifts.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { eventDate, nextSchoolDay, schoolDay, SCHOOL_TIMEZONE } from './tvSchedule.js'
import { scheduleResources, sharesScheduleResources } from './scheduleConflicts.js'
import { venuesOverlap } from './matchVenue.js'
import { sourceParticipant } from './thirdPlace.js'

const MINUTE = 60000
const key = (value) => normalizeFilterText(value).trim()
const time = (value) => eventDate(value).getTime()
const duration = (game) => Math.max(1, Number(game.durationMinutes) || 30) * MINUTE
const active = (game) => [MATCH_STATE.SCHEDULED, MATCH_STATE.LIVE].includes(getMatchState(game)) && game.matchCondition !== 'walkover' && Number.isFinite(time(game.dataHora))
const competition = (game) => JSON.stringify([game.sportId || '', getGameShift(game), game.tournamentId || ''])
const placeholder = (value) => /^(?:a definir|vencedor|perdedor|classificado|\d+\s*[oº°]?\s+grupo)/i.test(String(value || ''))
const schoolFormat = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const localTime = (millis) => {
  const parts = Object.fromEntries(schoolFormat.formatToParts(new Date(millis)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

// Unknown qualifiers reserve every possible class, rather than guessing a winner.
function participantResolver(games, teams, strictIds = new Set()) {
  const byId = new Map(games.map((game) => [game.id, game]))
  const cache = new Map()
  const dependencies = new Map()
  const resolve = (game, visiting = new Set()) => {
    if (cache.has(game.id)) return cache.get(game.id)
    if (visiting.has(game.id)) {
      if (strictIds.has(game.id)) throw new Error('Há uma ligação circular entre partidas do chaveamento.')
      return new Set()
    }
    const path = new Set([...visiting, game.id])
    const resources = new Set(), parents = new Set()
    const peers = games.filter((item) => competition(item) === competition(game))
    const add = (items) => items.forEach((resource) => resources.add(resource))
    const fallback = () => teams.filter((team) => team.sportId === game.sportId && (!getGameShift(game) || getTeamShift(team) === getGameShift(game))).forEach((team) => add(scheduleResources({ sportId: game.sportId, timeA: team.nome, teamIdA: team.id, turmaA: team.turma }, teams)))
    for (const side of ['A', 'B']) {
      const sourceId = game[`sourceGameId${side}`]
      if (sourceId) {
        const source = byId.get(sourceId)
        if (!source || competition(source) !== competition(game)) {
          if (strictIds.has(game.id)) throw new Error('Uma partida depende de um confronto que não está neste torneio.')
          fallback(); continue
        }
        parents.add(sourceId)
        const participant = sourceParticipant(source, game[`sourceOutcome${side}`])
        if (!game[`seedLabel${side}`] && !placeholder(game[`time${side}`])) add(scheduleResources({ sportId: game.sportId, timeA: game[`time${side}`], teamIdA: game[`teamId${side}`], turmaA: game[`turma${side}`] }, teams))
        else if (participant) add(scheduleResources({ sportId: game.sportId, timeA: participant.name, teamIdA: participant.teamId, turmaA: participant.turma }, teams))
        else add(resolve(source, path))
        continue
      }
      const seed = game[`seedLabel${side}`] || ''
      if (!seed && !placeholder(game[`time${side}`])) {
        add(scheduleResources({ sportId: game.sportId, timeA: game[`time${side}`], teamIdA: game[`teamId${side}`], turmaA: game[`turma${side}`] }, teams)); continue
      }
      const group = seed.match(/^\d+\s*[oº°ª]?\s+(grupo\s+.+)$/i)?.[1]
      const groupGames = peers.filter((item) => item.stageType === 'group' && (!group || key(item.groupName) === key(group)))
      if (groupGames.length) groupGames.forEach((item) => { parents.add(item.id); add(resolve(item, path)) })
      else fallback()
    }
    dependencies.set(game.id, parents)
    cache.set(game.id, resources)
    return resources
  }
  games.forEach((game) => resolve(game))
  return { cache, dependencies }
}

function integer(value, min, max, label) {
  const number = Number(value)
  if (value === '' || value == null || !Number.isInteger(number) || number < min || number > max) throw new Error(`${label}: informe um número inteiro entre ${min} e ${max}.`)
  return number
}

function settings(options) {
  const durationMinutes = integer(options.durationMinutes ?? 30, 1, 480, 'Duração prevista')
  const spacing = integer(options.intervaloMinutos ?? 30, 0, 480, 'Intervalo entre inícios')
  const rest = integer(options.descansoMinutos ?? 10, 0, 240, 'Descanso mínimo')
  const hours = Number(options.limiteHorasAntes ?? 1)
  if (!Number.isFinite(hours) || hours < 0 || hours > 720) throw new Error('Informe um prazo de palpites entre 0 e 720 horas antes do jogo.')
  const start = time(options.dataInicial)
  if (!Number.isFinite(start)) throw new Error('Informe uma data inicial válida para distribuir os horários.')
  const startClock = localTime(start).slice(11, 16)
  const finishClock = options.horarioFinal || ''
  if (finishClock && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(finishClock) || finishClock <= startClock)) throw new Error('O horário limite do dia deve ser posterior ao horário do primeiro jogo.')
  if (finishClock && time(`${schoolDay(start)}T${finishClock}`) - start < durationMinutes * MINUTE) throw new Error('A duração de uma partida não cabe no período informado.')
  const fitDay = (value) => {
    const rounded = Math.ceil(value / MINUTE) * MINUTE
    if (!finishClock) return rounded
    const day = schoolDay(rounded)
    const open = time(`${day}T${startClock}`), close = time(`${day}T${finishClock}`)
    if (rounded < open) return open
    return rounded + durationMinutes * MINUTE <= close ? rounded : time(`${nextSchoolDay(day)}T${startClock}`)
  }
  return { start, durationMinutes, cadence: Math.max(durationMinutes, spacing) * MINUTE, rest: rest * MINUTE, deadline: hours * 3600000, fitDay }
}

function firstSlot(game, earliest, busy, resources, config) {
  const blocks = busy.flatMap((other) => {
    const shared = sharesScheduleResources(resources.get(game.id), resources.get(other.id))
    if (!shared && !venuesOverlap(game, other)) return []
    const gap = shared ? config.rest : 0
    return [{ start: time(other.dataHora) - gap, end: time(other.dataHora) + duration(other) + gap }]
  }).sort((a, b) => a.start - b.start || a.end - b.end)
  let start = config.fitDay(earliest)
  for (const block of blocks) {
    if (start + config.durationMinutes * MINUTE <= block.start) break
    if (start < block.end) start = config.fitDay(block.end)
  }
  return start
}

export function planBracketSchedule(drafts, existing = [], teams = [], options = {}) {
  const result = { games: drafts, error: '', adjusted: 0, days: 0, unresolved: drafts.filter((game) => game.seedLabelA || game.seedLabelB || game.sourceGameIdA || game.sourceGameIdB).length }
  if (!drafts.length || !options.dataInicial) return result
  try {
    const config = settings(options)
    const relevant = existing.filter(active)
    const context = [...existing, ...drafts]
    const { cache: resources, dependencies } = participantResolver(context, teams, new Set(drafts.map((game) => game.id)))
    const remaining = new Map(drafts.map((game, index) => [game.id, { game, index }]))
    if (remaining.size !== drafts.length) throw new Error('Há partidas repetidas na prévia. Gere novamente o chaveamento.')
    const scheduled = new Map(existing.filter((game) => !remaining.has(game.id)).map((game) => [game.id, game]))
    const placed = []
    let cursor = config.start
    while (remaining.size) {
      let best = null
      for (const { game, index } of remaining.values()) {
        const parents = [...(dependencies.get(game.id) || [])]
        if (parents.some((id) => !scheduled.has(id))) continue
        const earliest = Math.max(cursor, config.start, ...parents.map((id) => time(scheduled.get(id).dataHora) + duration(scheduled.get(id)) + config.rest))
        const start = firstSlot(game, earliest, [...relevant, ...placed], resources, config)
        if (!best || start < best.start || (start === best.start && index < best.index)) best = { game, start, index }
      }
      if (!best) throw new Error('Não foi possível ordenar as fases. Confira os vínculos do mata-mata.')
      const next = { ...best.game, durationMinutes: config.durationMinutes, dataHora: localTime(best.start), limitePalpites: localTime(best.start - config.deadline) }
      placed.push(next); scheduled.set(next.id, next); remaining.delete(next.id)
      cursor = best.start + config.cadence
    }
    return { ...result, games: placed, adjusted: placed.filter((game) => time(game.dataHora) !== time(drafts.find((draft) => draft.id === game.id).dataHora)).length, days: new Set(placed.map((game) => schoolDay(game.dataHora))).size }
  } catch (error) { return { ...result, error: error.message } }
}

export function bracketScheduleConflicts(planned, existing = [], teams = [], restMinutes = 0) {
  const rest = integer(restMinutes, 0, 240, 'Descanso mínimo') * MINUTE
  const ids = new Set(planned.map((game) => game.id))
  const others = existing.filter((game) => !ids.has(game.id))
  const { cache: resources, dependencies } = participantResolver([...others, ...planned], teams, ids)
  const matches = new Map([...others, ...planned].map((game) => [game.id, game]))
  const issues = []
  planned.forEach((game, index) => {
    if (!Number.isFinite(time(game.dataHora))) { issues.push({ planned: game, game, reasons: ['Horário não definido'] }); return }
    for (const other of [...others.filter(active), ...planned.slice(0, index)]) {
      const shared = sharesScheduleResources(resources.get(game.id), resources.get(other.id))
      const gap = shared ? rest : 0
      if (time(game.dataHora) >= time(other.dataHora) + duration(other) + gap || time(other.dataHora) >= time(game.dataHora) + duration(game) + gap) continue
      const reasons = []
      if (shared) reasons.push(gap ? 'Mesma turma sem o descanso mínimo' : 'Mesma equipe ou turma')
      if (venuesOverlap(game, other)) reasons.push('Mesmo local')
      if (reasons.length) issues.push({ planned: game, game: other, reasons })
    }
    for (const id of dependencies.get(game.id) || []) {
      const parent = matches.get(id)
      if (!parent || time(game.dataHora) < time(parent.dataHora) + duration(parent) + rest) issues.push({ planned: game, game: parent || game, reasons: ['Fase anterior ainda não terminou ou falta descanso'] })
    }
  })
  return issues
}
