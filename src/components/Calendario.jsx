import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  calculateGroupStandings,
  canEditPrediction,
  GAME_STATUS,
  STATUS_LABELS,
  subscribeGames,
  subscribeUserPredictions,
} from '../services/bolaoService.js'
import { formatDateTime } from '../utils/format.js'
import { gameMatchesSearch, getGameStageLabel, getUniqueGamePhases, getUniqueGameSports } from '../utils/game.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'
import PendingGuessBanner from './PendingGuessBanner.jsx'

const ALL_ITEMS_FILTER = 'todos'

function getTournamentName(game) {
  return game?.tournamentName || game?.nomeTorneio || game?.fase || 'Torneio'
}

function groupGamesByTournament(games) {
  const grouped = new Map()

  games
    .filter((game) => game.tournamentId)
    .forEach((game) => {
      const current = grouped.get(game.tournamentId) || {
        id: game.tournamentId,
        nome: getTournamentName(game),
        esporteNome: game.esporteNome,
        games: [],
      }

      current.games.push(game)
      grouped.set(game.tournamentId, current)
    })

  return [...grouped.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function getTournamentGroups(games) {
  const groups = new Map()

  games
    .filter((game) => game.stageType === 'group' && game.groupName)
    .forEach((game) => {
      const current = groups.get(game.groupName) || []

      current.push(game)
      groups.set(game.groupName, current)
    })

  return [...groups.entries()].map(([name, groupGames]) => ({
    name,
    standings: calculateGroupStandings(groupGames),
  }))
}

function getTournamentKnockoutGames(games) {
  return games.filter((game) => game.stageType === 'knockout' || ['Quartas de final', 'Semifinal', 'Final'].includes(game.fase))
}

export default function Calendario({ onNavigate }) {
  const { user, isParticipant } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [sportFilter, setSportFilter] = useState(ALL_ITEMS_FILTER)
  const [phaseFilter, setPhaseFilter] = useState(ALL_ITEMS_FILTER)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeGames(
      (items) => {
        setGames(items)
        setLoading(false)
      },
      setError,
    )

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user || !isParticipant) {
      return () => {}
    }

    return subscribeUserPredictions(user.uid, setPredictions, setError)
  }, [isParticipant, user])

  const sportOptions = useMemo(() => getUniqueGameSports(games), [games])
  const phaseOptions = useMemo(() => getUniqueGamePhases(games), [games])
  const visibleGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSport =
        sportFilter === ALL_ITEMS_FILTER || game.sportId === sportFilter || game.esporteNome === sportFilter
      const matchesPhase = phaseFilter === ALL_ITEMS_FILTER || game.fase === phaseFilter

      return matchesSport && matchesPhase && gameMatchesSearch(game, searchTerm)
    })
  }, [games, phaseFilter, searchTerm, sportFilter])
  const nextGames = visibleGames.filter((game) => game.status === GAME_STATUS.OPEN).slice(0, 3)
  const visibleTournaments = useMemo(() => groupGamesByTournament(visibleGames), [visibleGames])
  const activePredictions = user && isParticipant ? predictions : []
  const predictionsByGame = useMemo(() => new Map(activePredictions.map((prediction) => [prediction.gameId, prediction])), [activePredictions])
  const pendingGuessCount = isParticipant ? games.filter((game) => canEditPrediction(game) && !predictionsByGame.has(game.id)).length : Number.NaN
  const statusCounts = useMemo(
    () => ({
      total: visibleGames.length,
      open: visibleGames.filter((game) => game.status === GAME_STATUS.OPEN).length,
      closed: visibleGames.filter((game) => game.status === GAME_STATUS.CLOSED).length,
      finished: visibleGames.filter((game) => game.status === GAME_STATUS.FINISHED).length,
    }),
    [visibleGames],
  )

  if (loading) {
    return <LoadingState label="Montando calendário..." />
  }

  return (
    <section className="page-shell calendar-page">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Calendário público</span>
          <h1>Jogos do bolão</h1>
          <p>Acompanhe horários, fases e confrontos antes de entrar para palpitar.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('login')}>
          Entrar para palpitar
        </button>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <PendingGuessBanner count={pendingGuessCount} onNavigate={onNavigate} />

      <section className="calendar-status-strip" aria-label="Resumo do calendário">
        <span>
          <strong>{statusCounts.total}</strong>
          Jogos filtrados
        </span>
        <span>
          <strong>{statusCounts.open}</strong>
          Abertos
        </span>
        <span>
          <strong>{statusCounts.closed}</strong>
          Encerrados
        </span>
        <span>
          <strong>{statusCounts.finished}</strong>
          Finalizados
        </span>
      </section>

      {nextGames.length ? (
        <section className="calendar-highlight">
          <div>
            <span className="eyebrow">Próximos jogos</span>
            <strong>{nextGames[0].timeA} x {nextGames[0].timeB}</strong>
            <p>{nextGames[0].esporteNome} | {getGameStageLabel(nextGames[0])} | {formatDateTime(nextGames[0].dataHora)}</p>
          </div>
          <div className="calendar-mini-list">
            {nextGames.slice(1).map((game) => (
              <span key={game.id}>
                {game.timeA} x {game.timeB} | {formatDateTime(game.dataHora)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

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

      {visibleTournaments.length ? (
        <section className="public-tournament-board">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Chaveamentos</span>
              <h2>Grupos e mata-mata</h2>
            </div>
            <span>{visibleTournaments.length} torneio(s)</span>
          </div>

          <div className="tournament-board-grid">
            {visibleTournaments.map((tournament) => {
              const groups = getTournamentGroups(tournament.games)
              const knockoutGames = getTournamentKnockoutGames(tournament.games)

              return (
                <article className="public-tournament-card" key={tournament.id}>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">{tournament.esporteNome}</span>
                      <h2>{tournament.nome}</h2>
                    </div>
                    <span>{tournament.games.length} jogo(s)</span>
                  </div>

                  {groups.length ? (
                    <div className="standings-grid">
                      {groups.map((group) => (
                        <div className="standings-table" key={`${tournament.id}-${group.name}`}>
                          <strong>{group.name}</strong>
                          <div className="standings-row standings-head">
                            <span>Time</span>
                            <span>Pts</span>
                            <span>SG</span>
                            <span>GP</span>
                          </div>
                          {group.standings.map((team) => (
                            <div className="standings-row" key={`${group.name}-${team.nome}`}>
                              <span>{team.nome}</span>
                              <span>{team.pontos}</span>
                              <span>{team.saldo}</span>
                              <span>{team.golsPro}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {knockoutGames.length ? (
                    <div className="public-bracket-lane">
                      {knockoutGames.map((game) => (
                        <span key={game.id}>
                          <strong>{game.fase}</strong>
                          {game.timeA} x {game.timeB}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {visibleGames.length ? (
        <div className="calendar-list">
          {visibleGames.map((game) => (
            <article className={`calendar-row game-status-${game.status}`} key={game.id}>
              <div>
                <span className={`status-badge status-${game.status}`}>{STATUS_LABELS[game.status] || game.status}</span>
                <strong>{game.timeA} x {game.timeB}</strong>
                <small>{game.esporteNome} | {getGameStageLabel(game)}</small>
              </div>
              <time>{formatDateTime(game.dataHora)}</time>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sem jogos no calendário" description="Assim que o admin criar jogos, eles aparecem aqui." />
      )}
    </section>
  )
}
