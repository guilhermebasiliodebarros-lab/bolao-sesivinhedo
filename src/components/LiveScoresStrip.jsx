import { useEffect, useState } from 'react'
import { subscribeGames } from '../services/bolaoService.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import MatchScore from './MatchScore.jsx'

export default function LiveScoresStrip() {
  const [games, setGames] = useState([])
  useEffect(() => subscribeGames(setGames), [])
  const live = games.filter((game) => getMatchState(game) === MATCH_STATE.LIVE && !game.deletionPending)
  if (!live.length) return null
  return <section className="live-scores-strip" aria-label="Placares ao vivo">
    <div className="live-scores-heading"><span className="live-dot" aria-hidden="true" /><strong>Ao vivo</strong><small>{live.length} partida(s)</small></div>
    <div className="live-scores-track" role="region" tabIndex={0} aria-label="Partidas simultâneas, deslize para ver todas">
      {live.map((game) => <article key={game.id} className="live-scores-match"><small>{game.esporteNome}</small><div><strong>{game.timeA}</strong><MatchScore game={game} /><strong>{game.timeB}</strong></div></article>)}
    </div>
  </section>
}
