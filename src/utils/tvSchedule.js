import { toDate } from './format.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { groupGamesBySport, matchesSport } from './game.js'

export const SCHOOL_TIMEZONE = 'America/Sao_Paulo'
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

export function eventDate(value) {
  // Date/time inputs are saved as school-local times, even when a TV uses another timezone.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) return new Date(`${value}-03:00`)
  return toDate(value)
}

export function schoolDay(value) {
  const date = eventDate(value)
  return Number.isNaN(date.getTime()) ? '' : dayFormat.format(date)
}

export function nextSchoolDay(day) {
  const date = new Date(`${day}T12:00:00-03:00`)
  return schoolDay(new Date(date.getTime() + 86400000))
}

export const TV_SECTIONS = [
  { id: 'live', label: 'Ao vivo', title: 'Acontecendo agora', description: 'Partidas simultâneas · placares em tempo real' },
  { id: 'today', label: 'Hoje', title: 'Jogos de hoje', description: 'Prepare a torcida para os próximos confrontos' },
  { id: 'tomorrow', label: 'Amanhã', title: 'Jogos de amanhã', description: 'Confira a programação do próximo dia' },
  { id: 'future', label: 'Outros dias', title: 'Próximos dias', description: 'A competição continua · acompanhe a agenda' },
  { id: 'waiting', label: 'Aguardando', title: 'Aguardando início', description: 'A organização ainda não iniciou estas partidas' },
  { id: 'results', label: 'Resultados', title: 'Últimos resultados', description: 'Confira os placares finais da competição' },
  { id: 'changes', label: 'Alterações', title: 'Alterações na programação', description: 'Partidas adiadas ou canceladas · acompanhe os avisos da organização' },
  { id: 'undated', label: 'A definir', title: 'Horários a definir', description: 'A programação destas partidas será atualizada' },
]

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

function interleave(groups) {
  const result = []
  const length = Math.max(0, ...groups.map((group) => group.length))
  for (let index = 0; index < length; index += 1) groups.forEach((group) => { if (group[index]) result.push(group[index]) })
  return result
}

export function buildTVSchedule(games, { day = schoolDay(new Date()), sport = '', livePageSize = 4, agendaPageSize = 6 } = {}) {
  const tomorrow = nextSchoolDay(day)
  const buckets = Object.fromEntries(TV_SECTIONS.map((section) => [section.id, []]))
  games.filter((game) => matchesSport(game, sport)).forEach((game) => {
    const state = getMatchState(game)
    const date = schoolDay(game.dataHora)
    const kind = [MATCH_STATE.POSTPONED, MATCH_STATE.CANCELLED].includes(state) ? 'changes' : state === MATCH_STATE.LIVE ? 'live' : state === MATCH_STATE.FINISHED ? 'results'
      : !date ? 'undated' : date < day ? 'waiting' : date === day ? 'today' : date === tomorrow ? 'tomorrow' : 'future'
    buckets[kind].push(game)
  })
  Object.entries(buckets).forEach(([kind, items]) => items.sort((a, b) => {
    const first = eventDate(kind === 'results' ? a.endedAt || a.dataHora : a.dataHora).getTime() || 0
    const second = eventDate(kind === 'results' ? b.endedAt || b.dataHora : b.dataHora).getTime() || 0
    return kind === 'results' ? second - first : first - second
  }))

  const balancedLive = interleave(groupGamesBySport(buckets.live).map((group) => group.games))
  const bySection = Object.fromEntries(TV_SECTIONS.map((section) => {
    const items = buckets[section.id]
    if (section.id === 'live') {
      return [section.id, chunks(balancedLive, livePageSize === 2 ? 2 : 4).map((matches, index, all) => ({ ...section, key: `live-${index}`, games: matches, part: index + 1, parts: all.length, sportName: 'Todos os esportes' }))]
    }
    const groups = groupGamesBySport(items).map((group) => chunks(group.games, section.id === 'changes' || agendaPageSize === 4 ? 4 : 6).map((matches, index, all) => ({ ...section, key: `${section.id}-${group.id}-${index}`, games: matches, part: index + 1, parts: all.length, sportName: group.nome })))
    return [section.id, interleave(groups)]
  }))
  // Rotate across categories and sports; bring live matches back between agenda pages.
  const agenda = interleave(TV_SECTIONS.filter((section) => section.id !== 'live').map((section) => bySection[section.id]))
  const live = bySection.live
  const slides = []
  for (let round = 0; round < Math.max(live.length, Math.ceil(agenda.length / 2)); round += 1) {
    if (live.length) slides.push(live[round % live.length])
    slides.push(...agenda.slice(round * 2, round * 2 + 2))
  }
  return {
    pages: slides.map((slide, index) => ({ ...slide, id: `${slide.key}-slot-${index}`, kind: slide.id })),
    counts: Object.fromEntries(TV_SECTIONS.map((section) => [section.id, buckets[section.id].length])),
    live: balancedLive,
    tomorrow,
  }
}
