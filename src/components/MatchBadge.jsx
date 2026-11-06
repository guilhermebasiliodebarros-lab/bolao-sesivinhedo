import { getMatchState, MATCH_STATE } from '../utils/match.js'

export default function MatchBadge({ game }) {
  const state = getMatchState(game)
  return (
    <span className={`match-badge match-badge-${state}`}>
      {state === MATCH_STATE.LIVE ? <span className="live-dot" aria-hidden="true" /> : null}
      {state === MATCH_STATE.LIVE ? 'Ao vivo' : state === MATCH_STATE.FINISHED ? 'Resultado final' : 'Agendado'}
    </span>
  )
}
