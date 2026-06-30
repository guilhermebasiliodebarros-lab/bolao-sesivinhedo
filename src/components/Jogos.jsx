import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { GAME_STATUS, subscribeGames, subscribeUserPredictions } from '../services/bolaoService.js'
import EmptyState from './EmptyState.jsx'
import GameCard from './GameCard.jsx'
import LoadingState from './LoadingState.jsx'

const filters = [
  { id: 'all', label: 'Todos' },
  { id: GAME_STATUS.OPEN, label: 'Abertos' },
  { id: GAME_STATUS.CLOSED, label: 'Encerrados' },
  { id: GAME_STATUS.FINISHED, label: 'Finalizados' },
]

export default function Jogos({ onNavigate }) {
  const { user, isParticipant, isMaster } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribeGames = subscribeGames(
      (items) => {
        setGames(items)
        setLoading(false)
      },
      setError,
    )

    return unsubscribeGames
  }, [])

  useEffect(() => {
    if (!user) {
      return () => {}
    }

    return subscribeUserPredictions(user.uid, setPredictions, setError)
  }, [user])

  const predictionsByGame = useMemo(() => {
    return new Map((user ? predictions : []).map((prediction) => [prediction.gameId, prediction]))
  }, [predictions, user])

  const visibleGames =
    activeFilter === 'all' ? games : games.filter((game) => game.status === activeFilter)

  if (loading) {
    return <LoadingState label="Buscando jogos..." />
  }

  return (
    <section className="page-shell">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Jogos e palpites</span>
          <h1>Calendario de jogos</h1>
          <p>Envie ou altere seus palpites enquanto o status estiver aberto.</p>
        </div>
        {!user ? (
          <button className="btn btn-primary" type="button" onClick={() => onNavigate('login')}>
            Entrar para palpitar
          </button>
        ) : null}
        {isMaster ? <span className="master-route-note">Logado como usuario master</span> : null}
      </div>

      {user && !isParticipant && !isMaster ? (
        <div className="alert alert-error">Seu perfil ainda nao esta liberado para palpites.</div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="segmented-control" role="tablist" aria-label="Filtro de jogos">
        {filters.map((filter) => (
          <button
            className={activeFilter === filter.id ? 'is-active' : ''}
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="game-grid">
        {visibleGames.length ? (
          visibleGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              existingPrediction={predictionsByGame.get(game.id)}
              onNavigate={onNavigate}
            />
          ))
        ) : (
          <EmptyState
            title="Nenhum jogo encontrado"
            description="Quando o administrador cadastrar jogos, eles aparecem nesta pagina."
            action={
              <button className="btn btn-outline" type="button" onClick={() => onNavigate('classificacao')}>
                Ver ranking
              </button>
            }
          />
        )}
      </div>
    </section>
  )
}
