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
  return { playerId, type: value.type, reason, gameId: String(value.gameId || '').trim(), scope: value.type === 'suspension' ? scope : 'modality' }
}

export function disciplineForGame(records = [], game = {}) {
  return records.filter((record) => record.status === 'active' && record.sportId === game.sportId && (!record.turno || !game.turno || record.turno === game.turno) && (record.type !== 'suspension' || record.scope !== 'tournament' || (record.tournamentId && record.tournamentId === game.tournamentId)))
}

export function suspendedPlayers(records, game) {
  return new Set(disciplineForGame(records, game).filter((record) => record.type === 'suspension').map((record) => record.playerId))
}
