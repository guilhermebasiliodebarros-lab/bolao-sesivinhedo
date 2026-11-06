import { getMatchState, getMatchLabel, MATCH_STATE } from '../utils/match.js'

export default function MatchBadge({ game }) {
  const state = getMatchState(game)
  return (
    <span className={`match-badge match-badge-${state}`}>
      {state === MATCH_STATE.LIVE ? <span className="live-dot" aria-hidden="true" /> : null}
      {getMatchLabel(game)}
    </span>
  )
}
