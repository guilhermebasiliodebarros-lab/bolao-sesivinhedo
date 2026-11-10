import { scorePresentation } from '../utils/scorePresentation.js'

export default function MatchScore({ game, details = true }) {
  const score = scorePresentation(game)
  return <span className="match-score" aria-live="polite" aria-atomic="true">
    <span className="match-score-value" key={`${game.id}:${score.text}:${score.caption}`}>{score.text}</span>
    {details && score.caption ? <small className="match-score-caption">{score.caption}</small> : null}
    {details && score.partials ? <small className="match-score-partials">Parciais: {score.partials}</small> : null}
  </span>
}
