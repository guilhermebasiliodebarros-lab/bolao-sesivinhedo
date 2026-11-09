import { getMatchState, MATCH_STATE } from './match.js'
import { hasConfirmedTeams } from './attendance.js'
import { normalizeFilterText } from './game.js'
import { VEST_COLORS } from './sportRules.js'
import { venuesOverlap, venueKey } from './matchVenue.js'
import { attendanceTeamKey } from './attendance.js'
import { suspendedPlayers } from './discipline.js'

const key = (value) => normalizeFilterText(value).trim()
export const usesMatchVests = (game) => /fut|hand|basquet|volei|volley|queimada/.test(key(game.esporteNome))
export function liveStartConflicts(candidate, games = []) {
  return games.filter((game) => game.id !== candidate.id && getMatchState(game) === MATCH_STATE.LIVE).flatMap((game) => {
    const reasons = []
    if (venuesOverlap(candidate, game)) reasons.push('Área ocupada')
    if ([game.teamIdA, game.teamIdB].some((id) => id && [candidate.teamIdA, candidate.teamIdB].includes(id)) || (game.sportId === candidate.sportId && [game.timeA, game.timeB].some((name) => name && [candidate.timeA, candidate.timeB].map(key).includes(key(name))))) reasons.push('Equipe em outra partida')
    return reasons.length ? [{ game, reasons }] : []
  })
}
export function matchStartChecklist(game, { games = [], attendance = null, discipline = {} } = {}) {
  const conflicts = liveStartConflicts(game, games)
  const participants = Boolean(game.timeA && game.timeB && key(game.timeA) !== key(game.timeB) && !game.seedLabelA && !game.seedLabelB)
  const rosterChecked = !attendance || ['A', 'B'].every((side) => !attendance[side]?.players?.length || (attendance[side].players.every((player) => ['present', 'absent'].includes(player.status)) && attendance[side].players.some((player) => player.status === 'present')))
  return [
    { id: 'state', label: 'Partida disponível para iniciar', done: getMatchState(game) === MATCH_STATE.SCHEDULED },
    { id: 'teams', label: 'Duas equipes definidas', done: participants },
    { id: 'presence', label: 'Duas equipes presentes', done: hasConfirmedTeams(game) },
    { id: 'players', label: 'Jogadores conferidos', done: rosterChecked },
    { id: 'discipline', label: 'Suspensões conferidas: atletas suspensos fora da escalação', done: ['A', 'B'].every((side) => { const suspended = suspendedPlayers(discipline[side], game); return !(attendance?.[side]?.players || []).some((player) => player.status === 'present' && suspended.has(player.id)) }) },
    { id: 'venue', label: 'Local definido', done: Boolean(String(game.venue || '').trim()) },
    { id: 'vests', label: usesMatchVests(game) ? 'Coletes definidos e com cores diferentes' : 'Modalidade sem exigência de coletes', done: !usesMatchVests(game) || (VEST_COLORS.includes(game.vestA) && VEST_COLORS.includes(game.vestB) && game.vestA !== game.vestB) },
    { id: 'conflicts', label: 'Local e equipes disponíveis', done: conflicts.length === 0, conflicts },
  ]
}

export const preparationKey = (game) => JSON.stringify([attendanceTeamKey(game), String(game.dataHora?.toMillis?.() ?? game.dataHora ?? ''), venueKey(game.venue), venueKey(game.venueArea), game.vestA || '', game.vestB || ''])
export function isMatchPrepared(game, teams = []) {
  if (getMatchState(game) !== MATCH_STATE.SCHEDULED || !hasConfirmedTeams(game) || game.preparation?.key !== preparationKey(game)) return false
  return ['A', 'B'].every((side) => {
    const team = teams.find((item) => item.id === game[`teamId${side}`] || (item.sportId === game.sportId && item.nome === game[`time${side}`]))
    return !team || game.preparation[`playerCount${side}`] === Number(team.playerCount || 0)
  })
}
