import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  canEditPrediction,
  GAME_STATUS,
  subscribeGames,
  subscribeRanking,
  subscribeUserPredictions,
} from '../services/bolaoService.js'
import { getGameStageLabel } from '../utils/game.js'
import EmptyState from './EmptyState.jsx'
import GameCard from './GameCard.jsx'
import LoadingState from './LoadingState.jsx'

export default function Dashboard({ onNavigate }) {
  const { user, profile, profileLoading, isParticipant } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      return () => {}
    }

    const unsubscribeGames = subscribeGames(
      (items) => {
        setGames(items)
        setLoading(false)
      },
      setError,
    )
    const unsubscribePredictions = subscribeUserPredictions(user.uid, setPredictions, setError)
    const unsubscribeRanking = subscribeRanking(setRanking, setError)

    return () => {
      unsubscribeGames()
      unsubscribePredictions()
      unsubscribeRanking()
    }
  }, [user])

  const predictionsByGame = useMemo(() => {
    return new Map(predictions.map((prediction) => [prediction.gameId, prediction]))
  }, [predictions])

  const openGames = games.filter((game) => canEditPrediction(game)).slice(0, 4)
  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games])
  const scoredHistory = predictions.filter((prediction) => gamesById.get(prediction.gameId)?.status === GAME_STATUS.FINISHED)
  const participantPosition = ranking.findIndex((item) => item.id === user?.uid) + 1

  if (!user) {
    return null
  }

  if (loading || profileLoading) {
    return <LoadingState label="Carregando seu painel..." />
  }

  if (!isParticipant) {
    return (
      <section className="page-shell">
        <EmptyState
          title="Perfil de participante nao encontrado"
          description="Esta area e exclusiva para contas com role user e participaRanking true."
        />
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-heading">
        <span className="eyebrow">Painel do participante</span>
        <h1>Ola, {profile?.nome || user.displayName || 'participante'}</h1>
        <p>Acompanhe seus palpites, pontuacao e proximos jogos disponiveis.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="stats-grid">
        <article className="stat-card">
          <span>Pontuacao atual</span>
          <strong>{profile?.pontos || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Posicao</span>
          <strong>{participantPosition || '-'}</strong>
        </article>
        <article className="stat-card">
          <span>Acertos exatos</span>
          <strong>{profile?.acertosExatos || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Acertos resultado</span>
          <strong>{profile?.acertosResultado || 0}</strong>
        </article>
      </div>

      <div className="split-layout">
        <section>
          <div className="section-heading">
            <h2>Proximos jogos</h2>
            <button className="link-button" type="button" onClick={() => onNavigate('jogos')}>
              Ver todos
            </button>
          </div>

          <div className="card-list">
            {openGames.length ? (
              openGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  existingPrediction={predictionsByGame.get(game.id)}
                  compact
                  onNavigate={onNavigate}
                />
              ))
            ) : (
              <EmptyState
                title="Nenhum jogo aberto agora"
                description="Assim que a organizacao liberar novos jogos, eles aparecem aqui."
                action={
                  <button className="btn btn-outline" type="button" onClick={() => onNavigate('classificacao')}>
                    Ver classificacao
                  </button>
                }
              />
            )}
          </div>
        </section>

        <section>
          <div className="section-heading">
            <h2>Palpites enviados</h2>
            <button className="link-button" type="button" onClick={() => onNavigate('palpites')}>
              Detalhes
            </button>
          </div>

          <div className="mini-list">
            {predictions.length ? (
              predictions.slice(0, 6).map((prediction) => {
                const game = gamesById.get(prediction.gameId)

                return (
                  <article className="mini-item" key={prediction.id}>
                    <span>
                      {game
                        ? `${game.esporteNome} | ${getGameStageLabel(game)} | ${game.timeA} x ${game.timeB}`
                        : 'Jogo removido'}
                    </span>
                    <strong>
                      {prediction.palpiteA} x {prediction.palpiteB}
                    </strong>
                  </article>
                )
              })
            ) : (
              <EmptyState
                title="Voce ainda nao palpitou"
                description="Entre nos jogos abertos para enviar seu primeiro placar."
                action={
                  <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
                    Palpitar agora
                  </button>
                }
              />
            )}
          </div>

          <div className="section-heading dashboard-history-title">
            <h2>Historico de pontuacao</h2>
          </div>
          <div className="mini-list">
            {scoredHistory.length ? (
              scoredHistory.slice(0, 6).map((prediction) => {
                const game = gamesById.get(prediction.gameId)

                return (
                  <article className="mini-item" key={`score-${prediction.id}`}>
                    <span>
                      {game
                        ? `${game.esporteNome} | ${getGameStageLabel(game)} | ${game.timeA} x ${game.timeB}`
                        : 'Jogo removido'}
                    </span>
                    <strong>{prediction.pontos} ponto(s)</strong>
                  </article>
                )
              })
            ) : (
              <EmptyState
                title="Sem pontos finalizados"
                description="Quando um jogo for finalizado pelo master, seus pontos aparecem aqui."
              />
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
