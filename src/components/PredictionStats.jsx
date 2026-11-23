import { useEffect, useState } from 'react'
import { subscribePredictionStats } from '../services/bolaoService.js'
import { canRevealPredictionStats, predictionPercentages } from '../utils/predictionStats.js'
import './PredictionStats.css'

export default function PredictionStats({ game, now = new Date() }) {
  const allowed = canRevealPredictionStats(game, now)
  const [feed, setFeed] = useState({ gameId: '', data: null, loaded: false, error: '' })
  useEffect(() => {
    if (!allowed) return
    return subscribePredictionStats(game.id, (data) => setFeed({ gameId: game.id, data, loaded: true, error: '' }), (error) => setFeed({ gameId: game.id, data: null, loaded: true, error }))
  }, [allowed, game.id])
  if (!allowed) return null
  const current = feed.gameId === game.id ? feed : { loaded: false }
  const stats = predictionPercentages(current.data)
  return <details className="prediction-stats"><summary>Favoritos nos palpites</summary>{!current.loaded ? <p role="status">Carregando os percentuais…</p> : current.error ? <p role="status">Os percentuais ainda não estão disponíveis.</p> : !stats.total ? <p>Nenhum palpite válido apurado para esta partida.</p> : <><p>{stats.total} palpite(s) · percentuais divulgados após o fechamento</p><div className="prediction-stats-bars">{[['teamA', game.timeA], ['draw', 'Empate'], ['teamB', game.timeB]].filter(([key]) => key !== 'draw' || stats.draw > 0).map(([key, label]) => <div key={key}><span>{label}</span><meter min="0" max="100" value={stats[key]} aria-label={`${label}: ${stats[key]}%`} /><strong>{stats[key]}%</strong></div>)}</div><small>Percentuais agregados, sem identificar quem enviou cada palpite.</small></>}</details>
}
