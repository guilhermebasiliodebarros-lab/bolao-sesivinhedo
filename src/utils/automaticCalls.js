import { getMatchState, MATCH_STATE } from './match.js'
import { eventDate } from './tvSchedule.js'
import { matchVenueLabel } from './matchVenue.js'

export const DEFAULT_BROADCAST_SETTINGS = { autoCallsEnabled: true, leadMinutes: 10, showMatchClock: true }
export function normalizeBroadcastSettings(value = {}) {
  return { autoCallsEnabled: value.autoCallsEnabled !== false, leadMinutes: [5, 10, 15, 20, 30].includes(Number(value.leadMinutes)) ? Number(value.leadMinutes) : 10, showMatchClock: value.showMatchClock !== false }
}
export function buildAutomaticCalls(games, settings = DEFAULT_BROADCAST_SETTINGS, now = new Date()) {
  const config = normalizeBroadcastSettings(settings)
  if (!config.autoCallsEnabled) return []
  const timestamp = new Date(now).getTime()
  return games.flatMap((game) => {
    const start = eventDate(game.dataHora)
    const remaining = start.getTime() - timestamp
    if (getMatchState(game) !== MATCH_STATE.SCHEDULED || !game.timeA || !game.timeB || game.seedLabelA || game.seedLabelB || !Number.isFinite(remaining) || remaining <= 0 || remaining > config.leadMinutes * 60000) return []
    const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(start)
    return [{ id: `auto-${game.id}-${start.getTime()}`, gameId: game.id, type: 'chamada', source: 'automatic', active: true, expiresAt: start,
      text: `Atenção, ${game.timeA} e ${game.timeB}: preparem-se para ${game.startedAt ? 'retomar a partida' : 'a partida'} de ${game.esporteNome}${game.venue ? ` em ${matchVenueLabel(game)}` : ''}, às ${time}. Faltam ${Math.ceil(remaining / 60000)} minuto(s).`,
    }]
  }).sort((a, b) => a.expiresAt - b.expiresAt || a.id.localeCompare(b.id))
}
