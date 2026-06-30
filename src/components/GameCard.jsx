import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import {
  canEditPrediction,
  GAME_STATUS,
  getPredictionDeadline,
  isPredictionDeadlineOpen,
  savePrediction,
  STATUS_LABELS,
} from '../services/bolaoService.js'
import { formatDateTime, formatTimeRemaining, minutesUntil } from '../utils/format.js'
import { calculateGuessScore, hasFinalScore } from '../utils/scoring.js'

export default function GameCard({ game, existingPrediction, existingGuess, compact = false, onGuessSaved, onNavigate }) {
  const { user, profile, isParticipant, isMaster } = useAuth()
  const [draft, setDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const prediction = existingPrediction || existingGuess
  const deadline = getPredictionDeadline(game)
  const deadlineOpen = isPredictionDeadlineOpen(game, now)
  const countdownLabel = formatTimeRemaining(deadline, now)
  const minutesToDeadline = minutesUntil(deadline, now)
  const isDeadlineUrgent = deadlineOpen && minutesToDeadline !== null && minutesToDeadline <= 30
  const canEdit = Boolean(user && isParticipant && canEditPrediction(game, now))
  const result = prediction ? calculateGuessScore(game, prediction) : null
  const palpiteA = draft?.palpiteA ?? prediction?.palpiteA ?? ''
  const palpiteB = draft?.palpiteB ?? prediction?.palpiteB ?? ''
  const lockedMessage = isMaster
    ? 'Usuario master nao participa do bolao.'
    : game.status === GAME_STATUS.OPEN && !deadlineOpen
      ? `Prazo encerrado em ${formatDateTime(deadline)}.`
      : user
        ? 'Palpites bloqueados para este jogo.'
        : 'Entre para registrar seu palpite.'

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000)

    return () => window.clearInterval(interval)
  }, [])

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      palpiteA: current?.palpiteA ?? prediction?.palpiteA ?? '',
      palpiteB: current?.palpiteB ?? prediction?.palpiteB ?? '',
      [field]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!user) {
      setMessage('Entre para enviar seu palpite.')
      return
    }

    if (!isParticipant) {
      setMessage('Usuario master nao registra palpites.')
      return
    }

    try {
      setSaving(true)
      await savePrediction({ user, profile, game, palpiteA, palpiteB })
      setMessage('Palpite salvo com sucesso.')
      onGuessSaved?.()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={compact ? 'game-card is-compact' : 'game-card'}>
      <div className="game-card-header">
        <span className={`status-badge status-${game.status}`}>{STATUS_LABELS[game.status]}</span>
        <span>Jogo: {formatDateTime(game.dataHora)}</span>
        <span>Palpites ate: {formatDateTime(deadline)}</span>
      </div>

      <div
        className={[
          'deadline-pill',
          isDeadlineUrgent ? 'is-urgent' : '',
          deadlineOpen ? '' : 'is-closed',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span>{deadlineOpen ? (isDeadlineUrgent ? 'Ultimos minutos' : 'Contagem regressiva') : 'Palpites encerrados'}</span>
        <strong>{countdownLabel}</strong>
      </div>

      <div className="scoreboard">
        <strong>{game.timeA}</strong>
        <span className="score-display">
          {game.status === GAME_STATUS.FINISHED && hasFinalScore(game) ? `${game.placarA} x ${game.placarB}` : 'x'}
        </span>
        <strong>{game.timeB}</strong>
      </div>

      {prediction ? (
        <div className="guess-summary">
          <span>Seu palpite</span>
          <strong>
            {prediction.palpiteA} x {prediction.palpiteB}
          </strong>
          {game.status === GAME_STATUS.FINISHED ? (
            <small>
              {result.points} ponto{result.points === 1 ? '' : 's'}
            </small>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <form className="guess-form" onSubmit={handleSubmit}>
          <label>
            {game.timeA}
            <input
              type="number"
              min="0"
              step="1"
              value={palpiteA}
              onChange={(event) => updateDraft('palpiteA', event.target.value)}
              required
            />
          </label>
          <span>x</span>
          <label>
            {game.timeB}
            <input
              type="number"
              min="0"
              step="1"
              value={palpiteB}
              onChange={(event) => updateDraft('palpiteB', event.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary btn-small" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : prediction ? 'Atualizar' : 'Enviar'}
          </button>
        </form>
      ) : (
        <div className="locked-note">
          {lockedMessage}
          {!user && onNavigate ? (
            <button type="button" onClick={() => onNavigate('login')}>
              Entrar
            </button>
          ) : null}
        </div>
      )}

      {message ? (
        <div className={message.includes('sucesso') ? 'alert alert-success' : 'alert alert-error'}>{message}</div>
      ) : null}
    </article>
  )
}
