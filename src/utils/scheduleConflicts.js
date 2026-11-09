import { normalizeFilterText } from './game.js'
import { eventDate } from './tvSchedule.js'
import { venuesOverlap } from './matchVenue.js'
import { schoolClassCode } from './schoolClasses.js'

const key = (value) => normalizeFilterText(value).trim()
const classCode = (value) => schoolClassCode(key(value).replace(/\b(?:ensino medio|e\.?\s*m\.?)\b/g, '').replace(/\s+/g, ' '))

export function scheduleResources(game, teams = []) {
  const resources = new Set()
  for (const side of ['A', 'B']) {
    if (game[`seedLabel${side}`]) continue
    const name = game[`time${side}`]
    const id = game[`teamId${side}`]
    const team = teams.find((item) => id && item.id === id) || teams.find((item) => item.sportId === game.sportId && key(item.nome) === key(name))
    const turma = team?.turma || game[`turma${side}`]
    const code = classCode(turma) || classCode(team?.nome || name)
    if (id || team?.id) resources.add(`team:${id || team.id}`)
    if (name) resources.add(`name:${game.sportId || ''}:${key(name)}`)
    if (code || turma) resources.add(`class:${code || key(turma)}`)
  }
  return resources
}

export const sharesScheduleResources = (first, second) => [...first].some((resource) => second.has(resource))

export function findScheduleConflicts(candidate, games, teams = []) {
  const withClasses = (game) => {
    const teamFor = (side) => teams.find((team) => team.id === game[`teamId${side}`] || (team.sportId === game.sportId && team.nome === game[`time${side}`]))
    return { ...game, turmaA: teamFor('A')?.turma || game.turmaA, turmaB: teamFor('B')?.turma || game.turmaB }
  }
  candidate = withClasses(candidate)
  const start = eventDate(candidate.dataHora).getTime()
  if (!Number.isFinite(start)) return []
  const end = start + Number(candidate.durationMinutes || 30) * 60000
  const key = (value) => normalizeFilterText(value).trim()
  const names = new Set([candidate.timeA, candidate.timeB].filter((_, side) => !candidate[`seedLabel${side ? 'B' : 'A'}`]).map(key).filter(Boolean))
  const classes = new Set([candidate.turmaA || (classCode(candidate.timeA) && candidate.timeA), candidate.turmaB || (classCode(candidate.timeB) && candidate.timeB)].map((value) => classCode(value) || key(value)).filter(Boolean))
  const ids = new Set([candidate.teamIdA, candidate.teamIdB].filter(Boolean))
  return games.filter((game) => game.id !== candidate.id && game.status !== 'finalizado' && !['cancelled', 'postponed'].includes(game.matchCondition)).map(withClasses).flatMap((game) => {
    const otherStart = eventDate(game.dataHora).getTime()
    const otherEnd = otherStart + Number(game.durationMinutes || 30) * 60000
    if (!Number.isFinite(otherStart) || start >= otherEnd || otherStart >= end) return []
    const reasons = []
    if (venuesOverlap(candidate, game)) reasons.push('Mesmo local')
    const sameSport = !game.sportId || !candidate.sportId || game.sportId === candidate.sportId
    const sameTeamName = sameSport && [game.timeA, game.timeB].some((value, side) => !game[`seedLabel${side ? 'B' : 'A'}`] && value && names.has(key(value)))
    if ([game.teamIdA, game.teamIdB].some((id) => id && ids.has(id)) || sameTeamName || sharesScheduleResources(scheduleResources(candidate, teams), scheduleResources(game, teams)) || [game.turmaA, game.turmaB].some((value) => value && classes.has(classCode(value) || key(value)))) reasons.push('Mesma equipe ou turma')
    return reasons.length ? [{ game, reasons }] : []
  })
}
