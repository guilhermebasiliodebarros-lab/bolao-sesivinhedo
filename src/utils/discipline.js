import { matchClockValue } from './matchClock.js'
import { getMatchState, MATCH_STATE } from './match.js'

export const DISCIPLINE_TYPES = { warning: 'Advertência', yellow: 'Cartão amarelo', red: 'Cartão vermelho', suspension: 'Suspensão' }
export const DISCIPLINE_STATUSES = { active: 'Registrado', served: 'Cumprida', void: 'Anulado' }

export function normalizeDisciplineInput(value = {}) {
  const playerId = String(value.playerId || '').trim()
  const reason = String(value.reason || '').trim()
  const scope = value.scope || 'modality'
  if (!playerId || !Object.hasOwn(DISCIPLINE_TYPES, value.type)) throw new Error('Selecione o atleta e o tipo da ocorrência.')
  if (reason.length < 3 || reason.length > 1000) throw new Error('Informe um motivo de 3 a 1.000 caracteres.')
  if (!['modality', 'tournament'].includes(scope)) throw new Error('Selecione a abrangência da suspensão.')
  if (scope === 'tournament' && !value.gameId) throw new Error('Selecione uma partida do torneio para limitar a suspensão.')
  const minute = value.minute == null || String(value.minute).trim() === '' ? null : Number(value.minute)
  if (minute !== null && (!Number.isInteger(minute) || minute < 0 || minute > 999)) throw new Error('Informe um minuto inteiro entre 0 e 999.')
  return { playerId, type: value.type, reason, gameId: String(value.gameId || '').trim(), scope: value.type === 'suspension' ? scope : 'modality', minute }
}

// Publish only the match incident. Reasons and disciplinary decisions stay private.
export function publicCardEvent(game, { id, type, teamId, teamName, playerName, minute = null }, now = new Date()) {
  if (!game || !['yellow', 'red'].includes(type)) return null
  const side = ['A', 'B'].find((key) => game[`teamId${key}`] ? game[`teamId${key}`] === teamId : game[`time${key}`] === teamName)
  if (!side) throw new Error('O cartão precisa pertencer a uma equipe desta partida.')
  const elapsedMs = minute !== null ? minute * 60000 : getMatchState(game) === MATCH_STATE.LIVE ? matchClockValue(game, now).elapsedMs : null
  return { id, kind: type, side, playerName: String(playerName || '').trim().split(/\s+/)[0], elapsedMs, recordedAt: now.getTime() }
}

export function disciplineForGame(records = [], game = {}) {
  return records.filter((record) => record.status === 'active' && record.sportId === game.sportId && (!record.turno || !game.turno || record.turno === game.turno) && (record.type !== 'suspension' || record.scope !== 'tournament' || (record.tournamentId && record.tournamentId === game.tournamentId)))
}

export function suspendedPlayers(records, game) {
  return new Set(disciplineForGame(records, game).filter((record) => record.type === 'suspension').map((record) => record.playerId))
}
