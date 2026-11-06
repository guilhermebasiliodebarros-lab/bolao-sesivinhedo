import { getMatchState, MATCH_STATE } from './match.js'
import { isMatchPrepared, liveStartConflicts, matchStartChecklist } from './matchStart.js'
import { eventDate } from './tvSchedule.js'
import { matchClockValue } from './matchClock.js'

export const PENDING_CATEGORIES = [
  { id: 'results', label: 'Resultados a conferir' },
  { id: 'late', label: 'Início atrasado' },
  { id: 'postponed', label: 'Adiados' },
  { id: 'ready', label: 'Prontas para iniciar' },
  { id: 'prepare', label: 'Conferência pendente' },
  { id: 'teams', label: 'Equipes a definir' },
]

// One entry per game. Time alerts never imply a result or change the match state.
export function buildPendingMatches(games, teams = [], now = new Date()) {
  const currentTime = now.getTime()
  return games.flatMap((game) => {
    const state = getMatchState(game)
    if ([MATCH_STATE.CANCELLED, MATCH_STATE.FINISHED].includes(state)) return []
    const scheduledAt = eventDate(game.dataHora).getTime()
    const startedAt = eventDate(game.startedAt || game.dataHora).getTime()
    const expectedEnd = startedAt + (Number(game.durationMinutes) || 30) * 60000
    const ready = isMatchPrepared(game, teams)
    const conflicts = liveStartConflicts(game, games)
    const entry = { game, ready, conflicts, scheduledAt }
    if (state === MATCH_STATE.POSTPONED) return [{ ...entry, category: 'postponed', reasons: [game.conditionReason || 'Defina a nova programação da partida.'], action: 'reschedule' }]
    if (state === MATCH_STATE.LIVE) {
      return (game.clock ? matchClockValue(game, now).exceeded : expectedEnd <= currentTime) ? [{ ...entry, category: 'results', reasons: ['A duração prevista foi atingida. Confira se o jogo continua ou se o resultado já pode ser lançado.'], action: 'score' }] : []
    }
    if (game.startedAt) return [{ ...entry, category: 'results', reasons: ['Esta partida já teve início e ainda não tem resultado final.'], action: 'score' }]
    const checks = matchStartChecklist(game)
    if (!checks.find((check) => check.id === 'teams').done) return [{ ...entry, category: 'teams', reasons: ['Aguarde a definição dos participantes. Confira os resultados das etapas anteriores ou edite os participantes em Jogos.'], action: 'none' }]
    const instructions = { presence: 'Confirmar a presença das duas equipes', venue: 'Definir o local na preparação', vests: 'Escolher coletes de cores diferentes' }
    const reasons = checks.filter((check) => !check.done && !['state', 'players', 'conflicts'].includes(check.id)).map((check) => instructions[check.id] || check.label)
    if (!ready) reasons.push('Salvar a conferência de equipes e jogadores')
    conflicts.forEach(({ game: other, reasons: occupied }) => reasons.push(`${occupied.join(' e ')}: ${other.timeA} × ${other.timeB}`))
    const action = ready && !conflicts.length ? 'start' : 'prepare'
    if (scheduledAt <= currentTime) return [{ ...entry, category: 'late', reasons: ['Horário previsto já passou; o início ainda não foi registrado.', ...reasons], action }]
    return [{ ...entry, category: ready ? 'ready' : 'prepare', reasons: reasons.length ? reasons : ['Conferência salva. Aguardando autorização para iniciar.'], action }]
  }).sort((a, b) => PENDING_CATEGORIES.findIndex((category) => category.id === a.category) - PENDING_CATEGORIES.findIndex((category) => category.id === b.category)
    || (Number.isFinite(a.scheduledAt) ? a.scheduledAt : Infinity) - (Number.isFinite(b.scheduledAt) ? b.scheduledAt : Infinity)
    || String(a.game.id).localeCompare(String(b.game.id)))
}
