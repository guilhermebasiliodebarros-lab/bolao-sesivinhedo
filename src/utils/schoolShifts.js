import { normalizeFilterText } from './game.js'

export const SCHOOL_SHIFTS = [{ id: 'manha', label: 'Manhã', description: '9º A/B e 1º, 2º e 3º A/B do Ensino Médio' }, { id: 'tarde', label: 'Tarde', description: '6º, 7º e 8º A/B do Fundamental II' }]
export const shiftLabel = (turno) => SCHOOL_SHIFTS.find((shift) => shift.id === turno)?.label || 'Turno não definido'
const valid = (value) => SCHOOL_SHIFTS.some((shift) => shift.id === value)
export function inferSchoolShift(value) {
  const text = normalizeFilterText(value).trim()
  const match = text.match(/^(?:turma\s*)?([1-9])(?:[º°ªo])?\s*(?:(?:ano|serie)\s*)?([ab])(?:\b|$)/)
  if (!match) return ''
  return ['6', '7', '8'].includes(match[1]) ? 'tarde' : ['9', '1', '2', '3'].includes(match[1]) ? 'manha' : ''
}
export const getTeamShift = (team = {}) => valid(team.turno) ? team.turno : inferSchoolShift(team.turma) || inferSchoolShift(team.nome)
export function getGameShift(game = {}, teams = []) {
  if (valid(game.turno)) return game.turno
  const shifts = ['A', 'B'].filter((side) => !game[`seedLabel${side}`]).map((side) => {
    const team = teams.find((item) => item.id === game[`teamId${side}`]) || teams.find((item) => item.sportId === game.sportId && item.nome === game[`time${side}`])
    return getTeamShift(team || { nome: game[`time${side}`] })
  }).filter(Boolean)
  return new Set(shifts).size === 1 ? shifts[0] : ''
}

export function resolveCompetitionShifts(games) {
  const competitions = new Map()
  games.forEach((game) => {
    if (!game.tournamentId) return
    const id = JSON.stringify([game.sportId || '', game.tournamentId])
    if (!competitions.has(id)) competitions.set(id, new Set())
    const turno = getGameShift(game)
    if (turno) competitions.get(id).add(turno)
  })
  return games.map((game) => {
    const shifts = competitions.get(JSON.stringify([game.sportId || '', game.tournamentId]))
    return { ...game, turno: getGameShift(game) || (shifts?.size === 1 ? [...shifts][0] : '') }
  })
}

export function validateTeamShift(team) {
  if (team.turno && !valid(team.turno)) throw new Error('Escolha Manhã ou Tarde para a equipe.')
  const inferred = inferSchoolShift(team.turma) || inferSchoolShift(team.nome)
  if (inferSchoolShift(team.turma) && inferSchoolShift(team.nome) && inferSchoolShift(team.turma) !== inferSchoolShift(team.nome)) throw new Error('Confira o nome e a turma: eles indicam turnos diferentes.')
  const turno = team.turno || inferred
  if (!turno) throw new Error('Escolha Manhã ou Tarde antes de cadastrar a equipe.')
  if (inferred && inferred !== turno) throw new Error(`Esta turma pertence ao turno da ${shiftLabel(inferred).toLocaleLowerCase('pt-BR')}. Troque a aba antes de cadastrar.`)
  return turno
}

export function validateGameShift(game, teams = []) {
  if (game.turno && !valid(game.turno)) throw new Error('Escolha Manhã ou Tarde para a partida.')
  const shifts = new Set()
  if (game.turno) shifts.add(game.turno)
  for (const side of ['A', 'B']) {
    if (game[`seedLabel${side}`]) continue
    const team = teams.find((item) => item.id === game[`teamId${side}`]) || teams.find((item) => item.sportId === game.sportId && item.nome === game[`time${side}`] && (!game.turno || getTeamShift(item) === game.turno)) || teams.find((item) => item.sportId === game.sportId && item.nome === game[`time${side}`])
    const turno = team ? getTeamShift(team) : inferSchoolShift(game[`time${side}`])
    if (turno) shifts.add(turno)
  }
  if (shifts.size > 1) throw new Error('Equipes da manhã e da tarde não podem disputar a mesma partida. Selecione equipes do mesmo turno.')
  return [...shifts][0] || ''
}
