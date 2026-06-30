import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  closeGame,
  deleteGame,
  deleteSport,
  finalizeGame,
  GAME_STATUS,
  isPredictionDeadlineOpen,
  recalculateScores,
  reopenGame,
  saveGame,
  saveSport,
  STATUS_LABELS,
  subscribeAllPredictions,
  subscribeGames,
  subscribeParticipants,
  subscribeSports,
} from '../services/bolaoService.js'
import { formatDateTime, formatPoints } from '../utils/format.js'
import { gameMatchesSearch, getGameStageLabel, getUniqueGamePhases } from '../utils/game.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'

const blankGame = {
  sportId: '',
  esporteNome: '',
  fase: 'Fase de grupos',
  rodada: '',
  timeA: '',
  timeB: '',
  dataHora: '',
  limitePalpites: '',
  placarA: '',
  placarB: '',
  status: GAME_STATUS.OPEN,
}

const blankSport = {
  id: '',
  nome: '',
}

const ALL_GAMES_FILTER = 'todos'
const ALL_PHASES_FILTER = 'todas'
const EXPIRED_GAMES_FILTER = 'prazo-vencido'

const PHASE_OPTIONS = ['Fase de grupos', 'Eliminatorias', 'Quartas de final', 'Semifinal', 'Final']

const GAME_FILTERS = [
  { value: ALL_GAMES_FILTER, label: 'Todos' },
  { value: GAME_STATUS.OPEN, label: 'Abertos' },
  { value: EXPIRED_GAMES_FILTER, label: 'Prazo vencido' },
  { value: GAME_STATUS.CLOSED, label: 'Encerrados' },
  { value: GAME_STATUS.FINISHED, label: 'Finalizados' },
]

const ADMIN_TABS = [
  { id: 'esportes', label: 'Esportes' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'palpites', label: 'Palpites' },
]

export default function AdminPanel({ onNavigate }) {
  const { user, isMaster } = useAuth()
  const [games, setGames] = useState([])
  const [sports, setSports] = useState([])
  const [participants, setParticipants] = useState([])
  const [predictions, setPredictions] = useState([])
  const [form, setForm] = useState(blankGame)
  const [sportForm, setSportForm] = useState(blankSport)
  const [finalScores, setFinalScores] = useState({})
  const [gameFilter, setGameFilter] = useState(ALL_GAMES_FILTER)
  const [selectedSportId, setSelectedSportId] = useState('')
  const [activeAdminTab, setActiveAdminTab] = useState('esportes')
  const [phaseFilter, setPhaseFilter] = useState(ALL_PHASES_FILTER)
  const [gameSearch, setGameSearch] = useState('')
  const [loadingState, setLoadingState] = useState({
    games: true,
    sports: true,
    participants: true,
    predictions: true,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)

  useEffect(() => {
    const unsubscribeGames = subscribeGames(
      (items) => {
        setGames(items)
        setLoadingState((current) => ({ ...current, games: false }))
      },
      setMessage,
    )
    const unsubscribeSports = subscribeSports(
      (items) => {
        setSports(items)
        setLoadingState((current) => ({ ...current, sports: false }))
      },
      setMessage,
    )
    const unsubscribeParticipants = subscribeParticipants(
      (items) => {
        setParticipants(items)
        setLoadingState((current) => ({ ...current, participants: false }))
      },
      setMessage,
    )
    const unsubscribePredictions = subscribeAllPredictions(
      (items) => {
        setPredictions(items)
        setLoadingState((current) => ({ ...current, predictions: false }))
      },
      setMessage,
    )

    return () => {
      unsubscribeGames()
      unsubscribeSports()
      unsubscribeParticipants()
      unsubscribePredictions()
    }
  }, [])

  const loading = Object.values(loadingState).some(Boolean)
  const predictionsByGame = useMemo(() => {
    const grouped = new Map()

    predictions.forEach((prediction) => {
      const current = grouped.get(prediction.gameId) || []
      grouped.set(prediction.gameId, [...current, prediction])
    })

    return grouped
  }, [predictions])
  const participantIds = useMemo(() => new Set(participants.map((participant) => participant.id)), [participants])
  const sportNameById = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.nome])), [sports])
  const selectedSport = useMemo(
    () => sports.find((sport) => sport.id === selectedSportId) || null,
    [selectedSportId, sports],
  )
  const selectedSportGames = useMemo(() => {
    if (!selectedSportId) {
      return []
    }

    return games.filter((game) => game.sportId === selectedSportId || game.esporteNome === selectedSport?.nome)
  }, [games, selectedSport?.nome, selectedSportId])
  const predictionTabGames = selectedSport ? selectedSportGames : games
  const gameCountBySport = useMemo(() => {
    return games.reduce((counts, game) => {
      if (!game.sportId) {
        return counts
      }

      counts.set(game.sportId, (counts.get(game.sportId) || 0) + 1)
      return counts
    }, new Map())
  }, [games])
  const availablePhases = useMemo(() => {
    return [...new Set([...PHASE_OPTIONS, ...getUniqueGamePhases(selectedSportId ? selectedSportGames : games)])]
  }, [games, selectedSportGames, selectedSportId])
  const allExpiredOpenGames = useMemo(
    () => games.filter((game) => game.status === GAME_STATUS.OPEN && !isPredictionDeadlineOpen(game)),
    [games],
  )
  const expiredOpenGames = useMemo(
    () => selectedSportGames.filter((game) => game.status === GAME_STATUS.OPEN && !isPredictionDeadlineOpen(game)),
    [selectedSportGames],
  )
  const filteredGames = useMemo(() => {
    let statusFilteredGames = selectedSportGames

    if (gameFilter === EXPIRED_GAMES_FILTER) {
      statusFilteredGames = expiredOpenGames
    } else if (gameFilter !== ALL_GAMES_FILTER) {
      statusFilteredGames = selectedSportGames.filter((game) => game.status === gameFilter)
    }

    return statusFilteredGames.filter((game) => {
      const matchesPhase = phaseFilter === ALL_PHASES_FILTER || game.fase === phaseFilter

      return matchesPhase && gameMatchesSearch(game, gameSearch)
    })
  }, [expiredOpenGames, gameFilter, gameSearch, phaseFilter, selectedSportGames])
  const gameFilterCounts = useMemo(
    () => ({
      [ALL_GAMES_FILTER]: selectedSportGames.length,
      [GAME_STATUS.OPEN]: selectedSportGames.filter((game) => game.status === GAME_STATUS.OPEN).length,
      [EXPIRED_GAMES_FILTER]: expiredOpenGames.length,
      [GAME_STATUS.CLOSED]: selectedSportGames.filter((game) => game.status === GAME_STATUS.CLOSED).length,
      [GAME_STATUS.FINISHED]: selectedSportGames.filter((game) => game.status === GAME_STATUS.FINISHED).length,
    }),
    [expiredOpenGames.length, selectedSportGames],
  )
  const getPendingParticipants = (gamePredictions) => {
    const usersWithPrediction = new Set(
      gamePredictions
        .map((prediction) => prediction.userId)
        .filter((userId) => participantIds.has(userId)),
    )

    return participants.filter((participant) => !usersWithPrediction.has(participant.id))
  }
  const getPendingPredictionCount = (gamePredictions) => {
    return getPendingParticipants(gamePredictions).length
  }
  const stats = useMemo(() => {
    return {
      participantes: participants.length,
      esportes: sports.length,
      jogos: games.length,
      palpites: predictions.length,
      abertos: games.filter((game) => game.status === GAME_STATUS.OPEN).length,
      encerrados: games.filter((game) => game.status === GAME_STATUS.CLOSED).length,
      finalizados: games.filter((game) => game.status === GAME_STATUS.FINISHED).length,
      prazoVencido: allExpiredOpenGames.length,
    }
  }, [allExpiredOpenGames.length, games, participants, predictions, sports.length])

  if (!isMaster) {
    return (
      <section className="page-shell">
        <EmptyState
          title="Area restrita"
          description="Apenas usuarios master podem cadastrar jogos, finalizar placares e recalcular o ranking."
          action={
            <button className="btn btn-primary" type="button" onClick={() => onNavigate('dashboard')}>
              Voltar ao painel
            </button>
          }
        />
      </section>
    )
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateSportField = (sportId) => {
    setSelectedSportId(sportId)
    setForm((current) => ({
      ...current,
      sportId,
      esporteNome: sportNameById.get(sportId) || '',
    }))
  }

  const selectSport = (sport) => {
    setSelectedSportId(sport.id)
    setActiveAdminTab('jogos')
    setGameFilter(ALL_GAMES_FILTER)
    setPhaseFilter(ALL_PHASES_FILTER)
    setGameSearch('')
    setForm({
      ...blankGame,
      sportId: sport.id,
      esporteNome: sport.nome,
    })
    setMessage('')
  }

  const updateFinalScore = (gameId, field, value) => {
    setFinalScores((current) => ({
      ...current,
      [gameId]: {
        ...current[gameId],
        [field]: value,
      },
    }))
  }

  const editGame = (game) => {
    setSelectedSportId(game.sportId || '')
    setActiveAdminTab('jogos')
    setForm({
      id: game.id,
      sportId: game.sportId || '',
      esporteNome: game.esporteNome || sportNameById.get(game.sportId) || '',
      fase: game.fase || 'Fase unica',
      rodada: game.rodada || '',
      timeA: game.timeA || '',
      timeB: game.timeB || '',
      dataHora: game.dataHora || '',
      limitePalpites: game.limitePalpites || game.dataHora || '',
      placarA: game.placarA ?? '',
      placarB: game.placarB ?? '',
      status: game.status || GAME_STATUS.OPEN,
    })
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setForm(
      selectedSport
        ? {
            ...blankGame,
            sportId: selectedSport.id,
            esporteNome: selectedSport.nome,
          }
        : blankGame,
    )
    setMessage('')
  }

  const editSport = (sport) => {
    setActiveAdminTab('esportes')
    setSportForm({
      id: sport.id,
      nome: sport.nome,
    })
    setMessage('')
  }

  const resetSportForm = () => {
    setSportForm(blankSport)
    setMessage('')
  }

  const runAdminAction = async (action, successMessage) => {
    setMessage('')

    try {
      setSaving(true)
      await action()
      setMessage(successMessage)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmAdminAction = ({ title, description, confirmLabel, action, successMessage }) => {
    setConfirmDialog({
      title,
      description,
      confirmLabel,
      onConfirm: () => runAdminAction(action, successMessage),
    })
  }

  const closeConfirmDialog = () => {
    if (!saving) {
      setConfirmDialog(null)
    }
  }

  const handleConfirmDialog = async () => {
    const action = confirmDialog?.onConfirm

    setConfirmDialog(null)

    if (action) {
      await action()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    await runAdminAction(async () => {
      const esporteNome = sportNameById.get(form.sportId) || form.esporteNome
      const gamePayload = form.id
        ? { ...form, esporteNome }
        : {
            sportId: form.sportId,
            esporteNome,
            fase: form.fase,
            rodada: form.rodada,
            timeA: form.timeA,
            timeB: form.timeB,
            dataHora: form.dataHora,
            limitePalpites: form.limitePalpites,
            status: GAME_STATUS.OPEN,
          }

      await saveGame(gamePayload)
      resetForm()
    }, 'Jogo salvo e classificacao recalculada.')
  }

  const handleSportSubmit = async (event) => {
    event.preventDefault()

    await runAdminAction(async () => {
      await saveSport(sportForm)
      setSportForm(blankSport)
    }, 'Esporte salvo com sucesso.')
  }

  const handleDeleteSport = (sport) => {
    confirmAdminAction({
      title: 'Excluir esporte',
      description: `Excluir ${sport.nome}? Esta acao so e permitida quando nao existem jogos cadastrados nesse esporte.`,
      confirmLabel: 'Excluir esporte',
      action: async () => {
        await deleteSport(sport.id)

        if (selectedSportId === sport.id) {
          setSelectedSportId('')
          setForm(blankGame)
        }
      },
      successMessage: 'Esporte excluido com sucesso.',
    })
  }

  const handleFinalize = async (game) => {
    const draft = finalScores[game.id] || {}
    const finalA = draft.placarA ?? game.placarA ?? ''
    const finalB = draft.placarB ?? game.placarB ?? ''

    if (finalA === '' || finalB === '') {
      setMessage('Informe os dois placares antes de finalizar o jogo.')
      return
    }

    confirmAdminAction({
      title: 'Finalizar jogo',
      description: `Confirmar ${game.timeA} ${finalA} x ${finalB} ${game.timeB}? A pontuacao sera recalculada para todos os participantes.`,
      confirmLabel: 'Finalizar jogo',
      action: () =>
        finalizeGame({
          gameId: game.id,
          placarA: finalA,
          placarB: finalB,
          user,
        }),
      successMessage: 'Jogo finalizado e pontuacao recalculada.',
    })
  }

  const handleCloseExpiredGames = () => {
    if (!expiredOpenGames.length) {
      setMessage('Nao ha jogos abertos com prazo vencido.')
      return
    }

    confirmAdminAction({
      title: 'Encerrar jogos vencidos',
      description: `Encerrar ${expiredOpenGames.length} jogo(s) aberto(s) cujo prazo de palpite ja passou? Participantes nao poderao mais editar esses palpites.`,
      confirmLabel: 'Encerrar vencidos',
      action: () => Promise.all(expiredOpenGames.map((game) => closeGame(game.id))),
      successMessage: `${expiredOpenGames.length} jogo(s) encerrado(s) com sucesso.`,
    })
  }

  if (loading) {
    return <LoadingState label="Carregando area administrativa..." />
  }

  const isSuccessMessage = ['salvo', 'sucesso', 'recalculada', 'finalizado', 'encerrado', 'reaberto', 'excluido'].some(
    (term) => message.toLowerCase().includes(term),
  )

  return (
    <section className="page-shell admin-page">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Administracao</span>
          <h1>Painel master</h1>
          <p>Crie jogos, encerre palpites, lance placares finais e acompanhe todos os dados do bolao.</p>
        </div>
        <span className="master-badge">Logado como usuario master</span>
      </div>

      {message ? (
        <div className={isSuccessMessage ? 'alert alert-success' : 'alert alert-error'}>
          {message}
        </div>
      ) : null}

      <div className="stats-grid">
        <article className="stat-card">
          <span>Participantes</span>
          <strong>{stats.participantes}</strong>
        </article>
        <article className="stat-card">
          <span>Esportes</span>
          <strong>{stats.esportes}</strong>
        </article>
        <article className="stat-card">
          <span>Jogos</span>
          <strong>{stats.jogos}</strong>
        </article>
        <article className="stat-card">
          <span>Palpites</span>
          <strong>{stats.palpites}</strong>
        </article>
        <article className="stat-card">
          <span>Abertos</span>
          <strong>{stats.abertos}</strong>
        </article>
        <article className="stat-card">
          <span>Encerrados</span>
          <strong>{stats.encerrados}</strong>
        </article>
        <article className="stat-card">
          <span>Finalizados</span>
          <strong>{stats.finalizados}</strong>
        </article>
        <article className="stat-card">
          <span>Prazo vencido</span>
          <strong>{stats.prazoVencido}</strong>
        </article>
      </div>

      <div className="admin-tabs segmented-control" aria-label="Areas do painel master">
        {ADMIN_TABS.map((tab) => {
          const tabCount = {
            esportes: sports.length,
            jogos: selectedSport ? selectedSportGames.length : games.length,
            participantes: participants.length,
            palpites: predictions.length,
          }[tab.id]

          return (
            <button
              className={activeAdminTab === tab.id ? 'is-active' : ''}
              type="button"
              key={tab.id}
              aria-pressed={activeAdminTab === tab.id}
              onClick={() => setActiveAdminTab(tab.id)}
            >
              {tab.label} ({tabCount})
            </button>
          )
        })}
      </div>

      {activeAdminTab === 'esportes' ? (
      <form className="admin-form admin-sport-form" onSubmit={handleSportSubmit}>
        <div className="section-heading">
          <h2>{sportForm.id ? 'Editar esporte' : 'Esportes'}</h2>
          <button className="btn btn-outline btn-small" type="button" onClick={resetSportForm}>
            Novo esporte
          </button>
        </div>

        <div className="sport-create-row">
          <label>
            Nome do esporte ou prova
            <input
              type="text"
              value={sportForm.nome}
              onChange={(event) => setSportForm((current) => ({ ...current, nome: event.target.value }))}
              placeholder="Ex.: Basquete, Torta na cara"
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : sportForm.id ? 'Salvar esporte' : 'Cadastrar esporte'}
          </button>
        </div>

        {sports.length ? (
          <div className="sport-chip-list" aria-label="Esportes cadastrados">
            {sports.map((sport) => {
              const sportGameCount = gameCountBySport.get(sport.id) || 0

              return (
                <span
                  className={
                    selectedSportId === sport.id
                      ? 'sport-chip sport-chip-editable is-selected'
                      : 'sport-chip sport-chip-editable'
                  }
                  key={sport.id}
                >
                  <button className="sport-select-button" type="button" onClick={() => selectSport(sport)}>
                    <span>{sport.nome}</span>
                    <small>{sportGameCount} jogo(s)</small>
                  </button>
                  <button className="chip-action" type="button" onClick={() => editSport(sport)}>
                    Editar
                  </button>
                  <button
                    className="chip-action"
                    type="button"
                    disabled={saving || sportGameCount > 0}
                    onClick={() => handleDeleteSport(sport)}
                  >
                    Excluir
                  </button>
                </span>
              )
            })}
          </div>
        ) : null}
      </form>
      ) : null}

      {activeAdminTab === 'jogos' ? (
        selectedSport ? (
          <>
          <div className="selected-sport-bar">
            <div>
              <span className="eyebrow">Esporte selecionado</span>
              <strong>{selectedSport.nome}</strong>
            </div>
            <button className="btn btn-outline btn-small" type="button" onClick={resetForm}>
              Novo jogo em {selectedSport.nome}
            </button>
          </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="section-heading">
          <h2>{form.id ? 'Editar jogo' : 'Criar novo jogo'}</h2>
          <button className="btn btn-outline btn-small" type="button" onClick={resetForm}>
            Novo jogo
          </button>
        </div>

        <div className="form-grid">
          <label>
            Esporte
            <select
              value={form.sportId}
              onChange={(event) => updateSportField(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {sports.map((sport) => (
                <option value={sport.id} key={sport.id}>
                  {sport.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fase
            <input
              type="text"
              list="phase-options"
              value={form.fase}
              onChange={(event) => updateField('fase', event.target.value)}
              placeholder="Ex.: Eliminatorias"
              required
            />
          </label>
          <label>
            Rodada ou etapa
            <input
              type="text"
              value={form.rodada}
              onChange={(event) => updateField('rodada', event.target.value)}
              placeholder="Ex.: Rodada 1, Semifinal, Final"
            />
          </label>
          <label>
            Time A
            <input
              type="text"
              value={form.timeA}
              onChange={(event) => updateField('timeA', event.target.value)}
              placeholder="Ex.: SESI Vermelho"
              required
            />
          </label>
          <label>
            Time B
            <input
              type="text"
              value={form.timeB}
              onChange={(event) => updateField('timeB', event.target.value)}
              placeholder="Ex.: SESI Branco"
              required
            />
          </label>
          <label>
            Data e horario
            <input
              type="datetime-local"
              value={form.dataHora}
              onChange={(event) => updateField('dataHora', event.target.value)}
              required
            />
          </label>
          <label>
            Palpites ate
            <input
              type="datetime-local"
              value={form.limitePalpites}
              onChange={(event) => updateField('limitePalpites', event.target.value)}
              required
            />
          </label>
        </div>
        <datalist id="phase-options">
          {availablePhases.map((phase) => (
            <option value={phase} key={phase} />
          ))}
        </datalist>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Cadastrar jogo'}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={saving || !expiredOpenGames.length}
            onClick={handleCloseExpiredGames}
          >
            Encerrar vencidos
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={saving}
            onClick={() => runAdminAction(recalculateScores, 'Pontuacao recalculada com sucesso.')}
          >
            Recalcular pontuacao
          </button>
        </div>
      </form>

      <div className="admin-layout">
        <section className="admin-list">
          <div className="section-heading">
            <h2>Jogos de {selectedSport.nome}</h2>
            <span>
              {filteredGames.length} de {selectedSportGames.length} jogo(s)
            </span>
          </div>

          <div className="admin-filter-panel">
            <label>
              Buscar
              <input
                type="search"
                value={gameSearch}
                onChange={(event) => setGameSearch(event.target.value)}
                placeholder="Time ou fase..."
              />
            </label>
            <label>
              Fase
              <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
                <option value={ALL_PHASES_FILTER}>Todas</option>
                {availablePhases.map((phase) => (
                  <option value={phase} key={phase}>
                    {phase}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-filter-bar" aria-label="Filtrar jogos por situacao">
            <div className="segmented-control admin-segmented">
              {GAME_FILTERS.map((filter) => (
                <button
                  className={gameFilter === filter.value ? 'is-active' : ''}
                  key={filter.value}
                  type="button"
                  aria-pressed={gameFilter === filter.value}
                  onClick={() => setGameFilter(filter.value)}
                >
                  {filter.label} ({gameFilterCounts[filter.value]})
                </button>
              ))}
            </div>
          </div>

          {selectedSportGames.length ? (
            <div className="admin-game-list">
              {filteredGames.length ? (
                filteredGames.map((game) => {
                const gamePredictions = predictionsByGame.get(game.id) || []
                const pendingPredictions = getPendingPredictionCount(gamePredictions)
                const draft = finalScores[game.id] || {}
                const deadlineExpired = game.status === GAME_STATUS.OPEN && !isPredictionDeadlineOpen(game)
                const canSetFinalScore = game.status !== GAME_STATUS.OPEN

                return (
                  <article className="admin-game-row admin-game-row-detailed" key={game.id}>
                    <div>
                      <strong>
                        {game.timeA} x {game.timeB}
                      </strong>
                      <span>{game.esporteNome}</span>
                      <span>{getGameStageLabel(game)}</span>
                      <span>{formatDateTime(game.dataHora)}</span>
                      <span>Palpites ate {formatDateTime(game.limitePalpites)}</span>
                      <span className={`status-badge status-${game.status}`}>{STATUS_LABELS[game.status]}</span>
                      {deadlineExpired ? <span className="status-badge status-expired">Prazo vencido</span> : null}
                    </div>
                    {canSetFinalScore ? (
                      <div className="final-score-form">
                        <label>
                          Placar A
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.placarA ?? game.placarA ?? ''}
                            onChange={(event) => updateFinalScore(game.id, 'placarA', event.target.value)}
                          />
                        </label>
                        <label>
                          Placar B
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.placarB ?? game.placarB ?? ''}
                            onChange={(event) => updateFinalScore(game.id, 'placarB', event.target.value)}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="initial-score">
                        <span>Placar inicial</span>
                        <strong>0 x 0</strong>
                      </div>
                    )}
                    <div className="admin-actions">
                      <button className="btn btn-outline btn-small" type="button" onClick={() => editGame(game)}>
                        Editar
                      </button>
                      {game.status === GAME_STATUS.OPEN ? (
                        <button
                          className="btn btn-outline btn-small"
                          type="button"
                          disabled={saving}
                          onClick={() => runAdminAction(() => closeGame(game.id), 'Jogo encerrado para palpites.')}
                        >
                          Encerrar
                        </button>
                      ) : (
                        <button
                          className="btn btn-outline btn-small"
                          type="button"
                          disabled={saving}
                          onClick={() => runAdminAction(() => reopenGame(game.id), 'Jogo reaberto para palpites.')}
                        >
                          Reabrir
                        </button>
                      )}
                      {canSetFinalScore ? (
                        <button
                          className="btn btn-primary btn-small"
                          type="button"
                          disabled={saving}
                          onClick={() => handleFinalize(game)}
                        >
                          Finalizar
                        </button>
                      ) : null}
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        disabled={saving || gamePredictions.length > 0}
                        onClick={() => runAdminAction(() => deleteGame(game.id), 'Jogo excluido com sucesso.')}
                      >
                        Excluir
                      </button>
                    </div>
                    <div className="prediction-counts">
                      <span>{gamePredictions.length} palpite(s)</span>
                      <strong>{pendingPredictions} pendente(s)</strong>
                    </div>
                  </article>
                )
              })
              ) : (
                <EmptyState title="Nenhum jogo neste filtro" description="Troque o filtro para ver outros jogos." />
              )}
            </div>
          ) : (
            <EmptyState
              title="Nenhum jogo neste esporte"
              description="Use o formulario acima para criar o primeiro jogo deste esporte."
            />
          )}
        </section>

      </div>
          </>
        ) : (
          <EmptyState
            title="Escolha um esporte"
            description="Volte para a aba Esportes e clique em um esporte cadastrado para criar jogos, finalizar placares e acompanhar palpites daquele esporte."
            action={
              <button className="btn btn-primary" type="button" onClick={() => setActiveAdminTab('esportes')}>
                Ver esportes
              </button>
            }
          />
        )
      ) : (
        null
      )}

      {activeAdminTab === 'participantes' ? (
        <section className="admin-tab-panel">
          <div className="section-heading">
            <h2>Participantes</h2>
            <span>{participants.length} participante(s)</span>
          </div>
          <div className="mini-list admin-participant-grid">
            {participants.length ? (
              participants.map((participant) => (
                <article className="mini-item" key={participant.id}>
                  <span>{participant.nome}</span>
                  <strong>{formatPoints(participant.pontos)} pts</strong>
                </article>
              ))
            ) : (
              <EmptyState title="Sem participantes" description="Usuarios cadastrados aparecem aqui." />
            )}
          </div>
        </section>
      ) : null}

      {activeAdminTab === 'palpites' ? (
        <section className="admin-tab-panel">
          <div className="section-heading">
            <div>
              <h2>Palpites por jogo</h2>
              <p>{selectedSport ? `Filtrando por ${selectedSport.nome}.` : 'Mostrando todos os esportes.'}</p>
            </div>
            <span>{predictionTabGames.length} jogo(s)</span>
          </div>
          <div className="prediction-admin-list">
            {predictionTabGames.length ? (
              predictionTabGames.map((game) => {
                const gamePredictions = predictionsByGame.get(game.id) || []
                const pendingParticipants = getPendingParticipants(gamePredictions)
                const pendingPredictions = pendingParticipants.length

                return (
                  <article className="admin-prediction-group" key={`predictions-${game.id}`}>
                    <strong>
                      {game.timeA} x {game.timeB}
                    </strong>
                    <small>
                      {game.esporteNome} | {getGameStageLabel(game)}
                    </small>
                    <small>
                      {gamePredictions.length} enviado(s) | {pendingPredictions} pendente(s)
                    </small>
                    {pendingParticipants.length ? (
                      <div className="pending-list" aria-label="Participantes pendentes">
                        {pendingParticipants.slice(0, 8).map((participant) => (
                          <span key={participant.id}>{participant.nome}</span>
                        ))}
                        {pendingParticipants.length > 8 ? (
                          <span>+{pendingParticipants.length - 8} participante(s)</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="pending-list is-complete">
                        <span>Todos os participantes enviaram palpite.</span>
                      </div>
                    )}
                    {gamePredictions.length ? (
                      gamePredictions.map((prediction) => (
                        <span key={prediction.id}>
                          {prediction.nomeUsuario}: {prediction.palpiteA} x {prediction.palpiteB} (
                          {formatPoints(prediction.pontos)} pts)
                        </span>
                      ))
                    ) : (
                      <span>Nenhum palpite enviado.</span>
                    )}
                  </article>
                )
              })
            ) : (
              <EmptyState title="Sem jogos" description="Cadastre jogos para acompanhar palpites." />
            )}
          </div>
        </section>
      ) : null}

      {confirmDialog ? (
        <div className="modal-backdrop" role="presentation" onClick={closeConfirmDialog}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal-mark" aria-hidden="true" />
            <div className="confirm-modal-content">
              <span className="eyebrow">Confirmacao</span>
              <h2 id="confirm-modal-title">{confirmDialog.title}</h2>
              <p>{confirmDialog.description}</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" type="button" disabled={saving} onClick={closeConfirmDialog}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" disabled={saving} onClick={handleConfirmDialog}>
                {saving ? 'Processando...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
