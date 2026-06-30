import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  closeGame,
  deleteGame,
  finalizeGame,
  GAME_STATUS,
  isPredictionDeadlineOpen,
  recalculateScores,
  reopenGame,
  saveGame,
  STATUS_LABELS,
  subscribeAllPredictions,
  subscribeGames,
  subscribeParticipants,
} from '../services/bolaoService.js'
import { formatDateTime } from '../utils/format.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'

const blankGame = {
  timeA: '',
  timeB: '',
  dataHora: '',
  limitePalpites: '',
  placarA: '',
  placarB: '',
  status: GAME_STATUS.OPEN,
}

const ALL_GAMES_FILTER = 'todos'
const EXPIRED_GAMES_FILTER = 'prazo-vencido'

const GAME_FILTERS = [
  { value: ALL_GAMES_FILTER, label: 'Todos' },
  { value: GAME_STATUS.OPEN, label: 'Abertos' },
  { value: EXPIRED_GAMES_FILTER, label: 'Prazo vencido' },
  { value: GAME_STATUS.CLOSED, label: 'Encerrados' },
  { value: GAME_STATUS.FINISHED, label: 'Finalizados' },
]

export default function AdminPanel({ onNavigate }) {
  const { user, isMaster } = useAuth()
  const [games, setGames] = useState([])
  const [participants, setParticipants] = useState([])
  const [predictions, setPredictions] = useState([])
  const [form, setForm] = useState(blankGame)
  const [finalScores, setFinalScores] = useState({})
  const [gameFilter, setGameFilter] = useState(ALL_GAMES_FILTER)
  const [loadingState, setLoadingState] = useState({ games: true, participants: true, predictions: true })
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
  const expiredOpenGames = useMemo(
    () => games.filter((game) => game.status === GAME_STATUS.OPEN && !isPredictionDeadlineOpen(game)),
    [games],
  )
  const filteredGames = useMemo(() => {
    if (gameFilter === ALL_GAMES_FILTER) {
      return games
    }

    if (gameFilter === EXPIRED_GAMES_FILTER) {
      return expiredOpenGames
    }

    return games.filter((game) => game.status === gameFilter)
  }, [expiredOpenGames, gameFilter, games])
  const gameFilterCounts = useMemo(
    () => ({
      [ALL_GAMES_FILTER]: games.length,
      [GAME_STATUS.OPEN]: games.filter((game) => game.status === GAME_STATUS.OPEN).length,
      [EXPIRED_GAMES_FILTER]: expiredOpenGames.length,
      [GAME_STATUS.CLOSED]: games.filter((game) => game.status === GAME_STATUS.CLOSED).length,
      [GAME_STATUS.FINISHED]: games.filter((game) => game.status === GAME_STATUS.FINISHED).length,
    }),
    [expiredOpenGames.length, games],
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
      jogos: games.length,
      palpites: predictions.length,
      abertos: games.filter((game) => game.status === GAME_STATUS.OPEN).length,
      encerrados: games.filter((game) => game.status === GAME_STATUS.CLOSED).length,
      finalizados: games.filter((game) => game.status === GAME_STATUS.FINISHED).length,
      prazoVencido: expiredOpenGames.length,
    }
  }, [expiredOpenGames.length, games, participants, predictions])

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
    setForm({
      id: game.id,
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
    setForm(blankGame)
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
      const gamePayload = form.id
        ? form
        : {
            timeA: form.timeA,
            timeB: form.timeB,
            dataHora: form.dataHora,
            limitePalpites: form.limitePalpites,
            status: GAME_STATUS.OPEN,
          }

      await saveGame(gamePayload)
      setForm(blankGame)
    }, 'Jogo salvo e classificacao recalculada.')
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

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="section-heading">
          <h2>{form.id ? 'Editar jogo' : 'Criar novo jogo'}</h2>
          <button className="btn btn-outline btn-small" type="button" onClick={resetForm}>
            Novo jogo
          </button>
        </div>

        <div className="form-grid">
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
            <h2>Jogos cadastrados</h2>
            <span>
              {filteredGames.length} de {games.length} jogo(s)
            </span>
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

          {games.length ? (
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
              title="Nenhum jogo cadastrado"
              description="Use o formulario acima para criar o primeiro jogo do bolao."
            />
          )}
        </section>

        <aside className="admin-side">
          <section>
            <div className="section-heading">
              <h2>Participantes</h2>
              <span>{participants.length}</span>
            </div>
            <div className="mini-list">
              {participants.length ? (
                participants.map((participant) => (
                  <article className="mini-item" key={participant.id}>
                    <span>{participant.nome}</span>
                    <strong>{participant.pontos} pts</strong>
                  </article>
                ))
              ) : (
                <EmptyState title="Sem participantes" description="Usuarios cadastrados aparecem aqui." />
              )}
            </div>
          </section>

          <section>
            <div className="section-heading">
              <h2>Palpites por jogo</h2>
              <span>{predictions.length}</span>
            </div>
            <div className="prediction-admin-list">
              {games.length ? (
                games.map((game) => {
                  const gamePredictions = predictionsByGame.get(game.id) || []
                  const pendingParticipants = getPendingParticipants(gamePredictions)
                  const pendingPredictions = pendingParticipants.length

                  return (
                    <article className="admin-prediction-group" key={`predictions-${game.id}`}>
                      <strong>
                        {game.timeA} x {game.timeB}
                      </strong>
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
                            {prediction.nomeUsuario}: {prediction.palpiteA} x {prediction.palpiteB} ({prediction.pontos}{' '}
                            pts)
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
        </aside>
      </div>

      {confirmDialog ? (
        <div className="modal-backdrop" role="presentation" onClick={closeConfirmDialog}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="eyebrow">Confirmacao</span>
            <h2 id="confirm-modal-title">{confirmDialog.title}</h2>
            <p>{confirmDialog.description}</p>
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
