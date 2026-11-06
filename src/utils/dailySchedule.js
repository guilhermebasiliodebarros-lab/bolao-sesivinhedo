import { eventDate, schoolDay, SCHOOL_TIMEZONE } from './tvSchedule.js'
import { getMatchCondition, getMatchLabel, getMatchScore, getMatchState, MATCH_STATE } from './match.js'
import { getGameStageLabel, matchesSport } from './game.js'
import { formatSportScore } from './sportRules.js'
import { matchVenueLabel } from './matchVenue.js'

export function dailySchedule(games, { day, sport = '', venue = '', includeCancelled = true }) {
  return games.filter((game) => schoolDay(game.dataHora) === day && matchesSport(game, sport) && (!venue || game.venue === venue)
    && (includeCancelled || getMatchState(game) !== MATCH_STATE.CANCELLED))
    .sort((a, b) => eventDate(a.dataHora) - eventDate(b.dataHora) || String(a.esporteNome).localeCompare(String(b.esporteNome), 'pt-BR') || matchVenueLabel(a).localeCompare(matchVenueLabel(b), 'pt-BR') || String(a.id).localeCompare(String(b.id)))
}

export function scheduleRow(game) {
  const state = getMatchState(game)
  const date = eventDate(game.dataHora)
  const time = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(date) : 'A definir'
  const scores = getMatchScore(game)
  const knownFinal = Number.isFinite(game.placarA) && Number.isFinite(game.placarB)
  const showScore = getMatchCondition(game) === 'normal' && (state === MATCH_STATE.LIVE || (state === MATCH_STATE.FINISHED && knownFinal))
  const status = [getMatchLabel(game), showScore ? `${scores.map(formatSportScore).join(' × ')}${state === MATCH_STATE.LIVE ? ' (parcial)' : ''}` : '', game.conditionReason].filter(Boolean).join('\n')
  return [time, game.esporteNome || 'A definir', `${game.timeA || 'A definir'} × ${game.timeB || 'A definir'}`, [game.tournamentName, getGameStageLabel(game)].filter(Boolean).join('\n'), matchVenueLabel(game) || 'A definir na preparação', [game.vestA ? `A: ${game.vestA}` : '', game.vestB ? `B: ${game.vestB}` : ''].filter(Boolean).join('\n') || 'A definir', status]
}

export const SCHEDULE_COLUMNS = ['Horário', 'Modalidade', 'Confronto', 'Torneio / fase', 'Local / área', 'Coletes', 'Situação / placar']
