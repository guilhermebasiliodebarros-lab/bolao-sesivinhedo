export const ATTENDANCE_LABELS = { pending: 'Não conferido', present: 'Presente', absent: 'Ausente' }
export const attendanceTeamKey = (game) => JSON.stringify([game.sportId || '', game.teamIdA || game.timeA || '', game.teamIdB || game.timeB || ''])
export function hasConfirmedTeams(game) {
  const summary = game.attendanceSummary
  return Boolean(summary && summary.teamKey === attendanceTeamKey(game) && summary.teamA === 'present' && summary.teamB === 'present')
}
export function currentAttendance(game, value) { return value?.teamKey === attendanceTeamKey(game) ? value : null }
export function normalizeAttendanceSide(value = {}, players = []) {
  const status = value.status || 'pending'
  if (!Object.hasOwn(ATTENDANCE_LABELS, status)) throw new Error('Selecione uma situação de presença válida para a equipe.')
  const selected = value.players || {}
  if (typeof selected !== 'object' || Array.isArray(selected)) throw new Error('Confira a lista de presença dos jogadores.')
  const ids = new Set(players.map((player) => player.id))
  if (Object.keys(selected).some((id) => !ids.has(id))) throw new Error('O elenco mudou. Reabra a conferência de presença para atualizar a lista.')
  const result = { status, players: players.map((player) => {
    const presence = selected[player.id] || 'pending'
    if (!Object.hasOwn(ATTENDANCE_LABELS, presence)) throw new Error('Selecione uma situação de presença válida para cada jogador.')
    return { id: player.id, nome: player.nome, posicao: player.posicao || '', capitao: Boolean(player.capitao), status: presence }
  }) }
  if (status === 'absent' && result.players.some((player) => player.status === 'present')) throw new Error('Uma equipe ausente não pode ter jogadores marcados como presentes.')
  return result
}
