import MatchDetails from './MatchDetails.jsx'

export default function MatchDetailsDisclosure({ game, children, label = 'Detalhes da partida' }) {
  if (!children && !game.vestA && !game.vestB && !game.tournamentName && !game.durationMinutes) return null
  return <details className="match-details-disclosure">
    <summary>{label}</summary>
    <div className="match-disclosure-content">
      {game.tournamentName ? <p><span>Torneio</span><strong>{game.tournamentName}</strong></p> : null}
      {game.durationMinutes ? <p><span>Duração prevista</span><strong>{game.durationMinutes} min</strong></p> : null}
      <MatchDetails game={game} showVenue={false} />
      {children}
    </div>
  </details>
}
