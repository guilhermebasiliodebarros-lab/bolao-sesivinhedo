import { useState } from 'react'
import usePredictionClock from '../hooks/usePredictionClock.js'
import usePredictionDraft from '../hooks/usePredictionDraft.js'
import { useAuth } from '../context/useAuth.js'
import {
  canEditPrediction,
  GAME_STATUS,
  getPredictionDeadline,
  isPredictionDeadlineOpen,
  savePrediction,
  STATUS_LABELS,
} from '../services/bolaoService.js'
import { formatDateTime, formatPoints, formatTimeRemaining, minutesUntil } from '../utils/format.js'
import { getGameStageLabel, getSportIcon, getSportVisualClass } from '../utils/game.js'
import { POINTS, calculateGuessScore, getScoreTypeLabel } from '../utils/scoring.js'
import { getMatchCondition, getMatchState, isPredictionVoided, MATCH_STATE } from '../utils/match.js'
import MatchScore from './MatchScore.jsx'
import MatchBadge from './MatchBadge.jsx'
import MatchDetails from './MatchDetails.jsx'
import MatchNotice from './MatchNotice.jsx'
import { getSportProfile, scoreLabel } from '../utils/sportRules.js'

export default function GameCard({ game, existingPrediction, existingGuess, compact = false, onGuessSaved, onNavigate }) {
  const { user, profile, isParticipant, isMaster } = useAuth()
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const now = usePredictionClock([game])

  const prediction = existingPrediction || existingGuess
  const deadline = getPredictionDeadline(game)
  const deadlineOpen = getMatchCondition(game) === 'normal' && isPredictionDeadlineOpen(game, now)
  const countdownLabel = formatTimeRemaining(deadline, now)
  const minutesToDeadline = minutesUntil(deadline, now)
  const isDeadlineUrgent = deadlineOpen && minutesToDeadline !== null && minutesToDeadline <= 30
  const canEdit = Boolean(user && isParticipant && canEditPrediction(game, now))
  const savedDraft = usePredictionDraft({ userId: isParticipant ? user?.uid : '', game, prediction, editable: canEdit })
  const draft = savedDraft.value
  const visibleStatus = game.status === GAME_STATUS.OPEN && !deadlineOpen ? GAME_STATUS.CLOSED : game.status
  const result = prediction ? calculateGuessScore(game, prediction) : null
  const palpiteA = draft?.palpiteA ?? prediction?.palpiteA ?? ''
  const palpiteB = draft?.palpiteB ?? prediction?.palpiteB ?? ''
  const predictionPreview = palpiteA !== '' && palpiteB !== '' ? `${palpiteA} x ${palpiteB}` : null
  const scoringRuleText = `Resultado ${formatPoints(POINTS.RESULT)} pts | Gol parcial ${formatPoints(
    POINTS.RESULT * POINTS.PARTIAL_SCORE_MULTIPLIER,
  )} pts | Placar exato ${formatPoints(POINTS.RESULT * POINTS.EXACT_SCORE_MULTIPLIER)} pts`
  const cardClassName = [
    'game-card',
    compact ? 'is-compact' : '',
    getSportVisualClass(game.esporteNome),
    `game-status-${game.status}`,
    isDeadlineUrgent ? 'is-deadline-urgent' : '',
    !deadlineOpen ? 'is-deadline-closed' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const lockedMessage = isMaster
    ? 'Usuário master não participa do Interclasse.'
    : game.status === GAME_STATUS.OPEN && !deadlineOpen
      ? `Prazo encerrado em ${formatDateTime(deadline)}.`
      : user
        ? 'Palpites bloqueados para este jogo.'
        : 'Entre para registrar seu palpite.'

  const updateDraft = savedDraft.update

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!user) {
      setMessage('Entre para enviar seu palpite.')
      return
    }

    if (!isParticipant) {
      setMessage('Usuário master não registra palpites.')
      return
    }

    try {
      setSaving(true)
      await savePrediction({ user, profile, game, palpiteA, palpiteB })
      savedDraft.clear()
      setMessage('Palpite salvo com sucesso.')
      setSavedFeedback(true)
      window.setTimeout(() => setSavedFeedback(false), 1200)
      onGuessSaved?.()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={cardClassName}>
      <span className="sport-illustration" aria-hidden="true" />
      {savedFeedback ? (
        <div className="prediction-save-burst" role="status">
          <span>Palpite salvo</span>
        </div>
      ) : null}
      <div className="game-card-header">
        <span className="sport-badge">
          <span className="sport-icon" aria-hidden="true">
            {getSportIcon(game.esporteNome)}
          </span>
          {game.esporteNome}
        </span>
        <span>{getGameStageLabel(game)}</span>
        {getMatchState(game) === MATCH_STATE.LIVE || getMatchCondition(game) !== 'normal' ? <MatchBadge game={game} /> : null}
        <span className={`status-badge status-${visibleStatus}`}>{STATUS_LABELS[visibleStatus]}</span>
        <span>Jogo: {formatDateTime(game.dataHora)}</span>
        <span>Palpites até: {formatDateTime(deadline)}</span>
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
        <span>{deadlineOpen ? (isDeadlineUrgent ? 'Últimos minutos' : 'Contagem regressiva') : 'Palpites encerrados'}</span>
        <strong>{isPredictionVoided(game) ? 'Palpites anulados' : getMatchCondition(game) === 'postponed' ? 'Aguardando novo horário' : countdownLabel}</strong>
      </div>

      <div className="scoreboard">
        <strong>{game.timeA}</strong>
        <span className="score-display">
          <MatchScore game={game} />
        </span>
        <strong>{game.timeB}</strong>
      </div>

      <p className="game-score-unit">{getSportProfile(game).scoringMode === 'sets' ? 'Palpites e resultado final em sets' : scoreLabel(game)}</p>
      <MatchDetails game={game} />
      <MatchNotice game={game} />

      {prediction ? (
        <div className="guess-summary">
          <span>Seu palpite</span>
          <strong>
            {prediction.palpiteA} x {prediction.palpiteB}
          </strong>
          {game.status === GAME_STATUS.FINISHED || isPredictionVoided(game) ? (
            <small className="score-detail">
              <span>{getScoreTypeLabel(result.type)}</span>
              <strong>
                {formatPoints(result.points)} ponto{result.points === 1 ? '' : 's'}
              </strong>
            </small>
          ) : (
            <small className="score-detail score-preview">
              <span>{predictionPreview ? `Previsão para ${predictionPreview}` : 'Regra de pontuação'}</span>
              <strong>{scoringRuleText}</strong>
            </small>
          )}
        </div>
      ) : null}

      {canEdit && savedDraft.hasDraft ? <div className="prediction-draft-note" role="status"><strong>Rascunho · ainda não enviado</strong><span>Recuperado neste navegador. Confira o placar e clique em {prediction ? 'Atualizar' : 'Enviar'} para confirmar.</span><button className="link-button" type="button" disabled={saving} onClick={() => savedDraft.clear()}>Descartar rascunho</button></div> : null}
      {canEdit && savedDraft.error ? <p className="alert alert-error" role="status">{savedDraft.error}</p> : null}
      {canEdit ? (
        <form className="guess-form" onSubmit={handleSubmit}>
          <label>
            {game.timeA}
            <input
              type="number"
              min="0"
              step={getSportProfile(game).scoringMode === 'chess' ? '0.5' : '1'}
              max={getSportProfile(game).scoringMode === 'chess' ? 1 : undefined}
              value={palpiteA}
              disabled={saving}
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
              step={getSportProfile(game).scoringMode === 'chess' ? '0.5' : '1'}
              max={getSportProfile(game).scoringMode === 'chess' ? 1 : undefined}
              value={palpiteB}
              disabled={saving}
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

      {canEdit && !prediction ? (
        <div className="score-rule-preview">
          <span>{predictionPreview ? `Previsão para ${predictionPreview}` : 'Regra de pontuação'}</span>
          <strong>{scoringRuleText}</strong>
        </div>
      ) : null}

      {message ? (
        <div className={message.includes('sucesso') ? 'alert alert-success' : 'alert alert-error'}>{message}</div>
      ) : null}
    </article>
  )
}
