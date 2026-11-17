import { getGameStageLabel, getSportIcon } from '../utils/game.js'
import { formatCalendarDay, formatCalendarTime } from '../utils/calendarExplorer.js'
import { eventDate, schoolDay } from '../utils/tvSchedule.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import MatchBadge from './MatchBadge.jsx'
import MatchScore from './MatchScore.jsx'

export default function MatchOverview({ game, row = false }) {
  const date = eventDate(game.dataHora)
  const previousTime = [MATCH_STATE.POSTPONED, MATCH_STATE.CANCELLED].includes(getMatchState(game))
  return <div className={row ? 'match-overview is-row' : 'match-overview'}>
    <div className="match-overview-heading"><span className="match-overview-sport"><span aria-hidden="true">{getSportIcon(game.esporteNome)}</span>{game.esporteNome}</span><MatchBadge game={game} /></div>
    <p className="match-overview-stage">{getGameStageLabel(game)}</p>
    <div className="match-overview-scoreboard"><strong>{game.timeA || 'Equipe a definir'}</strong><MatchScore game={game} /><strong>{game.timeB || 'Equipe a definir'}</strong></div>
    <div className="match-overview-meta">
      <time dateTime={Number.isFinite(date.getTime()) ? date.toISOString() : undefined}><small>{previousTime ? 'Horário anterior' : 'Horário'} · Brasília</small><strong>{formatCalendarTime(game.dataHora)}</strong>{Number.isFinite(date.getTime()) ? <span>{formatCalendarDay(schoolDay(game.dataHora), { weekday: undefined, month: 'short' })}</span> : null}</time>
      <span className="match-overview-venue"><small>Local</small><strong>{matchVenueLabel(game) || 'A definir'}</strong></span>
    </div>
  </div>
}
