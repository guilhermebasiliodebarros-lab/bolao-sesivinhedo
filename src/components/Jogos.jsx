import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { GAME_STATUS, subscribeGames, subscribeUserPredictions } from '../services/bolaoService.js'
import { gameMatchesSearch, getGameStageLabel, getUniqueGamePhases, getUniqueGameSports } from '../utils/game.js'
import EmptyState from './EmptyState.jsx'
import GameCard from './GameCard.jsx'
import LoadingState from './LoadingState.jsx'

const ALL_ITEMS_FILTER = 'all'

const filters = [
  { id: ALL_ITEMS_FILTER, label: 'Todos' },
  { id: GAME_STATUS.OPEN, label: 'Abertos' },
  { id: GAME_STATUS.CLOSED, label: 'Encerrados' },
  { id: GAME_STATUS.FINISHED, label: 'Finalizados' },
]

export default function Jogos({ onNavigate }) {
  const { user, isParticipant, isMaster } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [activeFilter, setActiveFilter] = useState(ALL_ITEMS_FILTER)
  const [sportFilter, setSportFilter] = useState(ALL_ITEMS_FILTER)
  const [phaseFilter, setPhaseFilter] = useState(ALL_ITEMS_FILTER)
  const [searchTerm, setSearchTerm] = useState('')
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

  const sportOptions = useMemo(() => getUniqueGameSports(games), [games])
  const phaseOptions = useMemo(() => getUniqueGamePhases(games), [games])
  const visibleGames = useMemo(() => {
    return games.filter((game) => {
      const matchesStatus = activeFilter === ALL_ITEMS_FILTER || game.status === activeFilter
      const matchesSport =
        sportFilter === ALL_ITEMS_FILTER || game.sportId === sportFilter || game.esporteNome === sportFilter
      const matchesPhase = phaseFilter === ALL_ITEMS_FILTER || game.fase === phaseFilter

      return matchesStatus && matchesSport && matchesPhase && gameMatchesSearch(game, searchTerm)
    })
  }, [activeFilter, games, phaseFilter, searchTerm, sportFilter])
  const groupedGames = useMemo(() => {
    const groups = new Map()

    visibleGames.forEach((game) => {
      const stage = getGameStageLabel(game)
      const key = `${game.esporteNome}-${stage}`
      const current = groups.get(key) || {
        key,
        esporteNome: game.esporteNome,
        stage,
        games: [],
      }

      current.games.push(game)
      groups.set(key, current)
    })

    return [...groups.values()]
  }, [visibleGames])

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
            aria-pressed={activeFilter === filter.id}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="public-filter-panel">
        <label>
          Buscar
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Time, esporte, fase..."
          />
        </label>
        <label>
          Esporte
          <select value={sportFilter} onChange={(event) => setSportFilter(event.target.value)}>
            <option value={ALL_ITEMS_FILTER}>Todos</option>
            {sportOptions.map((sport) => (
              <option value={sport.id} key={sport.id}>
                {sport.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fase
          <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
            <option value={ALL_ITEMS_FILTER}>Todas</option>
            {phaseOptions.map((phase) => (
              <option value={phase} key={phase}>
                {phase}
              </option>
            ))}
          </select>
        </label>
      </div>

      {groupedGames.length ? (
        <div className="game-groups">
          {groupedGames.map((group) => (
            <section className="game-group" key={group.key}>
              <div className="section-heading">
                <h2>{group.esporteNome}</h2>
                <span>{group.stage}</span>
              </div>
              <div className="game-grid">
                {group.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    existingPrediction={predictionsByGame.get(game.id)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="game-grid">
          <EmptyState
            title="Nenhum jogo encontrado"
            description="Quando o administrador cadastrar jogos, eles aparecem nesta pagina."
            action={
              <button className="btn btn-outline" type="button" onClick={() => onNavigate('classificacao')}>
                Ver ranking
              </button>
            }
          />
        </div>
      )}
    </section>
  )
}
