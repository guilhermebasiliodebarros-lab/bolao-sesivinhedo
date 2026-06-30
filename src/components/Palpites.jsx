import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { GAME_STATUS, subscribeGames, subscribeUserPredictions } from '../services/bolaoService.js'
import { formatPoints } from '../utils/format.js'
import { getGameStageLabel } from '../utils/game.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'

export default function Palpites({ onNavigate }) {
  const { user, isParticipant } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
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

    return () => {
      unsubscribeGames()
      unsubscribePredictions()
    }
  }, [user])

  const gamesById = useMemo(() => {
    return new Map(games.map((game) => [game.id, game]))
  }, [games])

  if (!user) {
    return null
  }

  if (loading) {
    return <LoadingState label="Carregando seus palpites..." />
  }

  if (!isParticipant) {
    return (
      <section className="page-shell">
        <EmptyState
          title="Area exclusiva de participantes"
          description="Usuarios master administram o sistema e nao registram palpites."
          action={
            <button className="btn btn-primary" type="button" onClick={() => onNavigate('admin')}>
              Ir para administracao
            </button>
          }
        />
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Historico</span>
          <h1>Meus palpites</h1>
          <p>Veja os placares enviados e a pontuacao recebida em jogos finalizados.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
          Novo palpite
        </button>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {predictions.length ? (
        <div className="prediction-list">
          {predictions.map((prediction) => {
            const game = gamesById.get(prediction.gameId)

            return (
              <article className="prediction-row" key={prediction.id}>
                <div>
                  <span>{game ? `${game.timeA} x ${game.timeB}` : 'Jogo nao encontrado'}</span>
                  {game ? <span>{`${game.esporteNome} | ${getGameStageLabel(game)}`}</span> : null}
                  <strong>
                    Palpite: {prediction.palpiteA} x {prediction.palpiteB}
                  </strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>
                    {game?.status === GAME_STATUS.FINISHED ? `${formatPoints(prediction.pontos)} ponto(s)` : 'Aguardando'}
                  </strong>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="Nenhum palpite enviado"
          description="Escolha um jogo aberto e registre seu placar."
          action={
            <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
              Ver jogos
            </button>
          }
        />
      )}
    </section>
  )
}
