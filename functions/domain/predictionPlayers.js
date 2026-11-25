import { getGameShift, getTeamShift } from './schoolShifts.js'

const nameKey = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('/')

export const usesTopScorer = (game = {}) => /basquet|basket|volei|voleibol|volley/.test(nameKey(game.esporteNome || game.nome))
export const usesExactScoreBonus = (game = {}) => /^(futebol|futsal|handebol)(\b|$)/.test(nameKey(game.esporteNome || game.nome))
export const predictionPlayerKey = (teamId, playerId) => validId(teamId) && validId(playerId) ? JSON.stringify([teamId, playerId]) : ''

export function parsePredictionPlayerKey(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.length !== 2 || !parsed.every(validId)) throw new Error('invalid')
    return { teamId: parsed[0], playerId: parsed[1] }
  } catch { throw new Error('Escolha um aluno da lista das equipes desta partida.') }
}

export function predictionTeamSide(game, team) {
  if (!team?.id || (game.sportId && team.sportId !== game.sportId)) return ''
  const shift = getGameShift(game), teamShift = getTeamShift(team)
  if (shift && teamShift !== shift) return ''
  const sides = ['A', 'B'].filter((side) => !game[`seedLabel${side}`] && (game[`teamId${side}`] ? game[`teamId${side}`] === team.id : game[`time${side}`] === team.nome))
  return sides.length === 1 ? sides[0] : ''
}

export function buildPredictionRoster(team, players) {
  if (!team?.id || !usesTopScorer(team)) return null
  const names = new Map()
  for (const player of players) {
    const nome = String(player.nome || '')
    if (validId(player.id) && nome.trim()) names.set(player.id, { id: player.id, nome })
  }
  return { teamId: team.id, teamName: team.nome || '', sportId: team.sportId || '', turno: getTeamShift(team), players: [...names.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id)) }
}

export function topScorerWinners(game) {
  if (!usesTopScorer(game) || game.eventsAdjusted || ['cancelled', 'walkover', 'postponed'].includes(game.matchCondition)) return []
  const players = new Map()
  for (const stat of Array.isArray(game.scorerStats) ? game.scorerStats : []) {
    if (!stat || !['A', 'B'].includes(stat.side) || !validId(stat.playerId) || !Number.isInteger(stat.total) || stat.total <= 0 || game[`seedLabel${stat.side}`]) continue
    const key = JSON.stringify([stat.side, stat.playerId])
    if ((players.get(key)?.total || 0) < stat.total) players.set(key, stat)
  }
  const highest = Math.max(0, ...[...players.values()].map((stat) => stat.total))
  return [...players.values()].filter((stat) => stat.total === highest)
}

export function hasCorrectTopScorer(game, prediction = {}) {
  if (!validId(prediction.topScorerTeamId) || !validId(prediction.topScorerPlayerId) || !['A', 'B'].includes(prediction.topScorerSide)) return false
  const teamId = game[`teamId${prediction.topScorerSide}`]
  if (teamId && teamId !== prediction.topScorerTeamId) return false
  return topScorerWinners(game).some((stat) => stat.side === prediction.topScorerSide && stat.playerId === prediction.topScorerPlayerId)
}
