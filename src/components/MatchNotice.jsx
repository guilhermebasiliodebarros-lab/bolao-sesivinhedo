import { getMatchCondition, getMatchOutcome, getWalkoverWinnerName } from '../utils/match.js'
import { tieBreakSummary } from '../utils/tieBreak.js'

export default function MatchNotice({ game }) {
  const condition = getMatchCondition(game)
  if (condition === 'normal') return game.tieBreak ? <div className="match-notice match-notice-tiebreak"><strong>{tieBreakSummary(game)}</strong>{['A', 'B'].includes(getMatchOutcome(game)) ? <span>Vencedor: {game[`time${getMatchOutcome(game)}`]}</span> : null}<small>Desempate separado do placar normal</small></div> : null
  return <div className={`match-notice match-notice-${condition}`}>
    <strong>{condition === 'walkover' ? `${getWalkoverWinnerName(game)} vence por W.O.` : condition === 'postponed' ? 'Partida adiada · novo horário a definir' : 'Partida cancelada'}</strong>
    {game.conditionReason ? <span>{game.conditionReason}</span> : null}
    {condition === 'walkover' && Number.isFinite(game.placarA) && Number.isFinite(game.placarB) ? <small>Placar regulamentar</small> : null}
  </div>
}
