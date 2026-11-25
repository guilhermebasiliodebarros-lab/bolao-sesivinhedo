import ShiftSelector from './ShiftSelector.jsx'
import { getGameShift } from '../utils/schoolShifts.js'
import { useEffect, useMemo, useState } from 'react'
import usePredictionClock from '../hooks/usePredictionClock.js'
import useSearchFocus from '../hooks/useSearchFocus.js'
import { useAuth } from '../context/useAuth.js'
import {
  calculateGroupStandings,
  canEditPrediction,
  subscribeGames,
  subscribeUserPredictions,
} from '../services/bolaoService.js'
import { getGameStageLabel, getUniqueGamePhases, groupGamesBySport } from '../utils/game.js'
import { CALENDAR_STATES, eventOverview, filterCalendarGames, formatCalendarDay, formatCalendarTime, groupCalendarDays } from '../utils/calendarExplorer.js'
import { schoolDay } from '../utils/tvSchedule.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import MatchOverview from './MatchOverview.jsx'
import MatchDetailsDisclosure from './MatchDetailsDisclosure.jsx'
import MatchNotice from './MatchNotice.jsx'
import SportFilter from './SportFilter.jsx'
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

export default function Calendario({ onNavigate, focusTarget }) {
  const { user, isParticipant, isViewer } = useAuth()
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [sportFilter, setSportFilter] = useState(focusTarget?.sportId || ALL_ITEMS_FILTER)
  const [turno, setTurno] = useState('')
  const [phaseFilter, setPhaseFilter] = useState(ALL_ITEMS_FILTER)
  const [searchTerm, setSearchTerm] = useState(focusTarget?.searchText || '')
  const [focusedGame, setFocusedGame] = useState(focusTarget?.gameId || '')
  const [dayFilter, setDayFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [venueFilter, setVenueFilter] = useState('')
  const [groupMode, setGroupMode] = useState('day')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = usePredictionClock(games)

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

  const phaseOptions = useMemo(() => getUniqueGamePhases(games), [games])
  const dateOptions = useMemo(() => [...new Set(games.map((game) => schoolDay(game.dataHora)).filter(Boolean))].sort(), [games])
  const venueOptions = useMemo(() => [...new Set(games.map((game) => game.venue).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [games])
  const filteredGames = useMemo(() => filterCalendarGames(games, {
    sport: sportFilter === ALL_ITEMS_FILTER ? '' : sportFilter,
    shift: turno, phase: phaseFilter === ALL_ITEMS_FILTER ? '' : phaseFilter,
    search: searchTerm, day: dayFilter, venue: venueFilter,
  }, now), [games, sportFilter, turno, phaseFilter, searchTerm, dayFilter, venueFilter, now])
  const visibleGames = useMemo(() => filteredGames.filter((game) => (!focusedGame || game.id === focusedGame) && (!stateFilter || getMatchState(game) === stateFilter)), [filteredGames, stateFilter, focusedGame])
  useSearchFocus(focusedGame, !loading, 'calendar-game-')
  const viewGroups = useMemo(() => groupMode === 'day' ? groupCalendarDays(visibleGames) : groupGamesBySport(visibleGames), [visibleGames, groupMode])
  const nextGames = useMemo(() => eventOverview(visibleGames, now).upcoming.slice(0, 3), [visibleGames, now])
  const visibleTournaments = useMemo(() => {
    const ids = new Set(visibleGames.map((game) => game.tournamentId).filter(Boolean))
    return groupGamesByTournament(games.filter((game) => ids.has(game.tournamentId)))
  }, [games, visibleGames])
  const predictionsByGame = useMemo(() => new Map((user && isParticipant ? predictions : []).map((prediction) => [prediction.gameId, prediction])), [isParticipant, predictions, user])
  const pendingGuessCount = isParticipant ? games.filter((game) => canEditPrediction(game, now) && !predictionsByGame.has(game.id)).length : Number.NaN
  const statusCounts = useMemo(() => Object.fromEntries(CALENDAR_STATES.map((state) => [state.id, filteredGames.filter((game) => !state.id || getMatchState(game) === state.id).length])), [filteredGames])
  const hasFilters = Boolean(sportFilter !== ALL_ITEMS_FILTER || turno || phaseFilter !== ALL_ITEMS_FILTER || searchTerm || dayFilter || stateFilter || venueFilter)
  const clearFilters = () => { setFocusedGame(''); setSportFilter(ALL_ITEMS_FILTER); setTurno(''); setPhaseFilter(ALL_ITEMS_FILTER); setSearchTerm(''); setDayFilter(''); setStateFilter(''); setVenueFilter('') }

  if (loading) {
    return <LoadingState label="Montando calendário…" variant="calendar" error={error} />
  }

  return (
    <section className="page-shell calendar-page">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Calendário público</span>
          <h1>Jogos do Interclasse</h1>
          <p>Encontre sua turma, confira a quadra e acompanhe cada resultado. Horários de Brasília.</p>
        </div>
        <div className="form-actions">
          {!isViewer ? <button className="btn btn-outline" type="button" onClick={() => onNavigate('tv')}>Abrir modo TV</button> : null}
          <button className="btn btn-outline" type="button" onClick={() => onNavigate('regulamentos')}>Consultar regulamentos</button>
          <button className="btn btn-outline" type="button" onClick={() => onNavigate('estatisticas')}>Ver estatísticas dos atletas</button>
          {!user ? <button className="btn btn-primary" type="button" onClick={() => onNavigate('login')}>Entrar para palpitar</button> : null}
        </div>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      {focusTarget && (focusedGame || searchTerm) ? <div className="search-focus-note"><span>Resultado da busca: <strong>{focusTarget.label}</strong></span><button className="btn btn-outline btn-small" type="button" onClick={clearFilters}>Ver todos os jogos</button></div> : null}

      <PendingGuessBanner count={pendingGuessCount} onNavigate={onNavigate} />

      <section className="calendar-filters" aria-label="Filtros do calendário">
        <div className="calendar-date-bar">
          <div className="segmented-control" role="group" aria-label="Atalhos de data">
            {[{ id: '', label: 'Todos os dias' }, { id: 'today', label: 'Hoje' }, { id: 'tomorrow', label: 'Amanhã' }].map((day) => <button type="button" key={day.id} className={dayFilter === day.id ? 'is-active' : ''} aria-pressed={dayFilter === day.id} onClick={() => setDayFilter(day.id)}>{day.label}</button>)}
          </div>
          <label>Data<select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}><option value="">Todas as datas</option><option value="today">Hoje</option><option value="tomorrow">Amanhã</option>{dateOptions.map((day) => <option key={day} value={day}>{formatCalendarDay(day, { month: 'short', year: 'numeric' })}</option>)}</select></label>
        </div>
        <div className="calendar-filter-grid">
          <label>Buscar jogo<input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Turma, modalidade, quadra…" /></label>
          <ShiftSelector value={turno} onChange={setTurno} />
          <label>Fase<select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}><option value={ALL_ITEMS_FILTER}>Todas as fases</option>{phaseOptions.map((phase) => <option value={phase} key={phase}>{phase}</option>)}</select></label>
          <label>Local<select value={venueFilter} onChange={(event) => setVenueFilter(event.target.value)}><option value="">Todos os locais</option>{venueOptions.map((venue) => <option key={venue} value={venue}>{venue}</option>)}</select></label>
        </div>
      </section>

      <SportFilter games={games.filter((game) => !turno || getGameShift(game) === turno)} value={sportFilter} onChange={setSportFilter} allValue={ALL_ITEMS_FILTER} turno={turno} />

      <div className="calendar-state-filters" role="group" aria-label="Situação da partida">
        {CALENDAR_STATES.map((state) => <button type="button" key={state.id} className={stateFilter === state.id ? 'is-active' : ''} aria-pressed={stateFilter === state.id} onClick={() => setStateFilter(state.id)}>{state.id === MATCH_STATE.LIVE ? <i className="calendar-live-dot" aria-hidden="true" /> : null}{state.label}<span>{statusCounts[state.id]}</span></button>)}
      </div>

      <div className="calendar-results-toolbar">
        <p role="status" aria-live="polite"><strong>{visibleGames.length}</strong> {visibleGames.length === 1 ? 'jogo encontrado' : 'jogos encontrados'}{hasFilters ? <button type="button" className="link-button" onClick={clearFilters}>Limpar filtros</button> : null}</p>
        <div className="segmented-control" role="group" aria-label="Organizar calendário"><button type="button" className={groupMode === 'day' ? 'is-active' : ''} aria-pressed={groupMode === 'day'} onClick={() => setGroupMode('day')}>Por dia</button><button type="button" className={groupMode === 'sport' ? 'is-active' : ''} aria-pressed={groupMode === 'sport'} onClick={() => setGroupMode('sport')}>Por esporte</button></div>
      </div>

      {nextGames.length ? (
        <section className="calendar-highlight">
          <div>
            <span className="eyebrow">Próximos jogos</span>
            <strong>{nextGames[0].timeA} x {nextGames[0].timeB}</strong>
            <p>{nextGames[0].esporteNome} | {getGameStageLabel(nextGames[0])} | {formatCalendarDay(schoolDay(nextGames[0].dataHora), { month: 'short' })} · {formatCalendarTime(nextGames[0].dataHora)}</p>
          </div>
          <div className="calendar-mini-list">
            {nextGames.slice(1).map((game) => (
              <span key={game.id}>
                {game.timeA} x {game.timeB} | {formatCalendarTime(game.dataHora)} · {formatCalendarDay(schoolDay(game.dataHora), { month: 'short' })}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {visibleTournaments.length ? (
        <details className="calendar-tournament-details">
          <summary>Consultar grupos e mata-mata <span>{visibleTournaments.length} torneio(s)</span></summary>
          <p className="calendar-tournament-note">As tabelas consideram todos os jogos oficiais de cada torneio, incluindo os que estão fora dos filtros acima.</p>
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
        </details>
      ) : null}

      {visibleGames.length ? (
        <div className="calendar-list">
          {viewGroups.map((group) => (
            <section className="calendar-sport-group" key={group.id}>
              <div className="section-heading"><h2>{group.nome}</h2><span>{group.games.length} jogo(s)</span></div>
              {group.games.map((game) => (
                <article id={`calendar-game-${game.id}`} tabIndex={-1} className={`calendar-row match-calendar-card game-status-${game.status}`} key={game.id}>
                  <MatchOverview game={game} row />
                  <MatchNotice game={game} />
                  <MatchDetailsDisclosure game={game} />
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title={hasFilters ? 'Nenhum jogo com esses filtros' : 'A programação vem aí'} description={hasFilters ? 'Experimente outra data, turma ou situação para encontrar a partida.' : 'Os jogos aparecem aqui assim que a organização divulgar a programação.'} action={hasFilters ? <button type="button" className="btn btn-outline" onClick={clearFilters}>Limpar filtros e ver jogos</button> : null} />
      )}
    </section>
  )
}
