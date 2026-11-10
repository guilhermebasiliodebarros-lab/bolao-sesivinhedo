import ShiftSelector from './ShiftSelector.jsx'
import usePredictionClock from '../hooks/usePredictionClock.js'
import { getGameShift } from '../utils/schoolShifts.js'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { canEditPrediction, GAME_STATUS, subscribeGames, subscribeUserPredictions } from '../services/bolaoService.js'
import { gameMatchesSearch, getGameStageLabel, getUniqueGamePhases } from '../utils/game.js'
import SportFilter from './SportFilter.jsx'
import { getMatchState, getMatchCondition, MATCH_STATE } from '../utils/match.js'
import EmptyState from './EmptyState.jsx'
import GameCard from './GameCard.jsx'
import LoadingState from './LoadingState.jsx'

const ALL_ITEMS_FILTER = 'all'

const filters = [
  { id: ALL_ITEMS_FILTER, label: 'Todos' },
  { id: 'ao-vivo', label: 'Ao vivo' },
  { id: 'postponed', label: 'Adiados' },
  { id: 'cancelled', label: 'Cancelados' },
  { id: 'walkover', label: 'W.O.' },
  { id: GAME_STATUS.OPEN, label: 'Abertos' },
  { id: GAME_STATUS.CLOSED, label: 'Palpites fechados' },
  { id: GAME_STATUS.FINISHED, label: 'Finalizados' },
]

export default function Jogos({ onNavigate }) {
  const { user, isParticipant, isMaster } = useAuth()
  const [games, setGames] = useState([])
  const now = usePredictionClock(games)
  const [predictions, setPredictions] = useState([])
  const [activeFilter, setActiveFilter] = useState(ALL_ITEMS_FILTER)
  const [sportFilter, setSportFilter] = useState(ALL_ITEMS_FILTER)
  const [turno, setTurno] = useState('')
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
  const openGamesAll = useMemo(() => games.filter((game) => canEditPrediction(game, now)), [games, now])
  const pendingOpenGames = useMemo(
    () => openGamesAll.filter((game) => !predictionsByGame.has(game.id)),
    [openGamesAll, predictionsByGame],
  )
  const allOpenGamesGuessed = Boolean(isParticipant && openGamesAll.length > 0 && pendingOpenGames.length === 0)
  const sportGames = useMemo(() => games.filter((game) => (!turno || getGameShift(game) === turno) && (sportFilter === ALL_ITEMS_FILTER || game.sportId === sportFilter || game.esporteNome === sportFilter)), [games, sportFilter, turno])
  const gameCounts = useMemo(
    () => ({
      [ALL_ITEMS_FILTER]: sportGames.length,
      'ao-vivo': sportGames.filter((game) => getMatchState(game) === MATCH_STATE.LIVE).length,
      postponed: sportGames.filter((game) => getMatchCondition(game) === 'postponed').length,
      cancelled: sportGames.filter((game) => getMatchCondition(game) === 'cancelled').length,
      walkover: sportGames.filter((game) => getMatchCondition(game) === 'walkover').length,
      [GAME_STATUS.OPEN]: sportGames.filter((game) => canEditPrediction(game, now)).length,
      [GAME_STATUS.CLOSED]: sportGames.filter((game) => game.status === GAME_STATUS.CLOSED || (game.status === GAME_STATUS.OPEN && !canEditPrediction(game, now))).length,
      [GAME_STATUS.FINISHED]: sportGames.filter((game) => game.status === GAME_STATUS.FINISHED).length,
    }),
    [sportGames, now],
  )
  const guessedOpenGames = Math.max(openGamesAll.length - pendingOpenGames.length, 0)
  const guessProgress = openGamesAll.length ? Math.round((guessedOpenGames / openGamesAll.length) * 100) : 0

  const phaseOptions = useMemo(() => getUniqueGamePhases(games), [games])
  const visibleGames = useMemo(() => {
    return games.filter((game) => {
      const matchesStatus = activeFilter === ALL_ITEMS_FILTER || (activeFilter === GAME_STATUS.OPEN ? canEditPrediction(game, now) : activeFilter === GAME_STATUS.CLOSED ? game.status === GAME_STATUS.CLOSED || (game.status === GAME_STATUS.OPEN && !canEditPrediction(game, now)) : activeFilter === 'ao-vivo' ? getMatchState(game) === MATCH_STATE.LIVE : ['postponed', 'cancelled', 'walkover'].includes(activeFilter) ? getMatchCondition(game) === activeFilter : game.status === activeFilter)
      const matchesSport =
        sportFilter === ALL_ITEMS_FILTER || game.sportId === sportFilter || game.esporteNome === sportFilter
      const matchesPhase = phaseFilter === ALL_ITEMS_FILTER || game.fase === phaseFilter

      return matchesStatus && matchesSport && matchesPhase && gameMatchesSearch(game, searchTerm)
    })
  }, [activeFilter, games, phaseFilter, searchTerm, sportFilter, now])
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
    return <LoadingState label="Buscando jogos..." error={error} />
  }

  return (
    <section className="page-shell">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Jogos e palpites</span>
          <h1>Calendário de jogos</h1>
          <p>Envie ou altere seus palpites até 5 minutos antes de cada jogo.</p>
        </div>
        {!user ? (
          <button className="btn btn-primary" type="button" onClick={() => onNavigate('login')}>
            Entrar para palpitar
          </button>
        ) : null}
        {isMaster ? <span className="master-route-note">Logado como usuário master</span> : null}
      </div>

      {user && !isParticipant && !isMaster ? (
        <div className="alert alert-error">Seu perfil ainda não está liberado para palpites.</div>
      ) : null}

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <section className="match-center-panel" aria-label="Resumo dos jogos">
        <div>
          <span className="eyebrow">Central de jogos</span>
          <h2>{pendingOpenGames.length ? `${pendingOpenGames.length} palpite(s) pendente(s)` : 'Nenhum palpite pendente'}</h2>
          <p>
            {openGamesAll.length
              ? `${guessedOpenGames} de ${openGamesAll.length} jogo(s) aberto(s) já têm palpite.`
              : 'Quando novos jogos abrirem, eles aparecem aqui com prazo e contagem regressiva.'}
          </p>
          <div className="progress-track" aria-label={`Progresso dos palpites ${guessProgress}%`}>
            <span style={{ width: `${guessProgress}%` }} />
          </div>
        </div>
        <div className="quick-stat-grid" aria-label="Contadores de jogos">
          <span>
            <strong>{games.length}</strong>
            Total
          </span>
          <span>
            <strong>{openGamesAll.length}</strong>
            Abertos
          </span>
          <span>
            <strong>{pendingOpenGames.length}</strong>
            Faltam
          </span>
          <span>
            <strong>{games.filter((game) => game.status === GAME_STATUS.FINISHED).length}</strong>
            Finalizados
          </span>
        </div>
      </section>

      {allOpenGamesGuessed ? (
        <div className="completion-banner" role="status">
          <div>
            <span className="eyebrow">Tudo em dia</span>
            <strong>Você já palpitou todos os jogos abertos.</strong>
            <p>Agora é só acompanhar os resultados e esperar a organização liberar novos jogos.</p>
          </div>
          <button className="btn btn-outline btn-small" type="button" onClick={() => onNavigate('palpites')}>
            Ver meus palpites
          </button>
        </div>
      ) : null}

      <div className="school-shift-filter"><ShiftSelector value={turno} onChange={setTurno} /></div>
      <SportFilter games={games} value={sportFilter} onChange={setSportFilter} allValue={ALL_ITEMS_FILTER} />

      <div className="segmented-control" role="tablist" aria-label="Filtro de jogos">
        {filters.map((filter) => (
          <button
            className={activeFilter === filter.id ? 'is-active' : ''}
            key={filter.id}
            type="button"
            aria-pressed={activeFilter === filter.id}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label} ({gameCounts[filter.id] || 0})
          </button>
        ))}
      </div>

      <div className="public-filter-panel public-filter-panel-compact">
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
            description="Quando o administrador cadastrar jogos, eles aparecem nesta página."
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
