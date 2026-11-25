import { useState } from 'react'
import usePredictionClock from '../hooks/usePredictionClock.js'
import usePredictionDraft from '../hooks/usePredictionDraft.js'
import { useAuth } from '../context/useAuth.js'
import { canEditPrediction, GAME_STATUS, getPredictionDeadline, savePrediction } from '../services/bolaoService.js'
import { formatPoints, formatTimeRemaining, minutesUntil } from '../utils/format.js'
import { formatCalendarDay, formatCalendarTime } from '../utils/calendarExplorer.js'
import { schoolDay } from '../utils/tvSchedule.js'
import { calculateGuessScore, getScoringRuleText, getScoreTypeLabel } from '../utils/scoring.js'
import { getMatchCondition, getMatchState, isPredictionVoided, MATCH_STATE } from '../utils/match.js'
import { getSportProfile, scoreLabel } from '../utils/sportRules.js'
import MatchOverview from './MatchOverview.jsx'
import MatchDetailsDisclosure from './MatchDetailsDisclosure.jsx'
import MatchNotice from './MatchNotice.jsx'
import PredictionStats from './PredictionStats.jsx'
import PredictionPlayerPicker, { PredictionPlayerSummary } from './PredictionPlayerPicker.jsx'
import { predictionPlayerKey } from '../utils/predictionPlayers.js'

export default function GameCard({ game, existingPrediction, existingGuess, compact = false, onGuessSaved, onNavigate }) {
  const { user, profile, isParticipant, isMaster } = useAuth()
  const [message, setMessage] = useState('')
  const [saveSucceeded, setSaveSucceeded] = useState(false)
  const [saving, setSaving] = useState(false)
  const now = usePredictionClock([game])
  const prediction = existingPrediction || existingGuess
  const deadline = getPredictionDeadline(game)
  const deadlineOpen = canEditPrediction(game, now)
  const countdownLabel = formatTimeRemaining(deadline, now)
  const remaining = minutesUntil(deadline, now)
  const urgent = deadlineOpen && remaining !== null && remaining <= 30
  const canEdit = Boolean(user && isParticipant && deadlineOpen)
  const savedDraft = usePredictionDraft({ userId: isParticipant ? user?.uid : '', game, prediction, editable: canEdit })
  const palpiteA = savedDraft.value?.palpiteA ?? prediction?.palpiteA ?? ''
  const palpiteB = savedDraft.value?.palpiteB ?? prediction?.palpiteB ?? ''
  const topScorer = savedDraft.value?.topScorer ?? predictionPlayerKey(prediction?.topScorerTeamId, prediction?.topScorerPlayerId)
  const result = prediction ? calculateGuessScore(game, prediction) : null
  const scoreProfile = getSportProfile(game)
  const isScheduled = getMatchState(game) === MATCH_STATE.SCHEDULED
  const scoringRuleText = getScoringRuleText(game)
  const lockedMessage = isMaster ? 'A organização acompanha os jogos pelo painel master.'
    : isPredictionVoided(game) ? 'Esta partida não conta para os palpites.'
      : getMatchCondition(game) === 'postponed' ? 'Aguarde a organização definir um novo horário.'
        : !user ? 'Entre para registrar seu palpite.'
          : 'Os palpites desta partida estão encerrados.'

  const submit = async (event) => {
    event.preventDefault()
    if (!user || !isParticipant || saving) return
    setMessage(''); setSaveSucceeded(false); setSaving(true)
    try {
      await savePrediction({ user, profile, game, palpiteA, palpiteB, topScorer })
      savedDraft.clear()
      setMessage('Palpite salvo com sucesso.')
      setSaveSucceeded(true)
      onGuessSaved?.()
    } catch (failure) { setMessage(failure.message) } finally { setSaving(false) }
  }

  return <article id={`game-${game.id}`} tabIndex={-1} className={['game-card', 'match-card', compact ? 'is-compact' : '', `game-status-${game.status}`, urgent ? 'is-deadline-urgent' : ''].filter(Boolean).join(' ')}>
    <MatchOverview game={game} />
    <MatchNotice game={game} />
    {prediction ? <div className="match-card-prediction"><div><span>Seu palpite</span><strong>{prediction.palpiteA} × {prediction.palpiteB}</strong></div>{game.status === GAME_STATUS.FINISHED || isPredictionVoided(game) ? <div className="match-card-points"><strong>{formatPoints(result.points)} ponto{result.points === 1 ? '' : 's'}</strong><small>{getScoreTypeLabel(result.type, game)}</small></div> : <span className="match-card-saved">Enviado</span>}</div> : null}
    <PredictionPlayerSummary game={game} prediction={prediction} />
    {isScheduled ? <div className={urgent ? 'match-card-deadline is-urgent' : 'match-card-deadline'}><div><span>{deadlineOpen ? 'Palpites até' : 'Palpites fechados'}</span>{deadline ? <strong>{formatCalendarTime(deadline)} <small>· {formatCalendarDay(schoolDay(deadline), { weekday: undefined, month: 'short' })}</small></strong> : <strong>Horário a definir</strong>}</div>{deadlineOpen ? <span>{countdownLabel}</span> : null}</div> : null}
    {canEdit && savedDraft.hasDraft ? <div className="prediction-draft-note" role="status"><strong>Rascunho · ainda não enviado</strong><span>Salvo neste navegador. Confira os valores e confirme seu palpite.</span><button className="link-button" type="button" disabled={saving} onClick={() => savedDraft.clear()}>Descartar rascunho</button></div> : null}
    {canEdit && savedDraft.error ? <p className="alert alert-error" role="status">{savedDraft.error}</p> : null}
    {canEdit ? <form className="guess-form" onSubmit={submit} aria-label="Registrar palpite">
      <label>{game.timeA}<input type="number" inputMode={scoreProfile.scoringMode === 'chess' ? 'decimal' : 'numeric'} min="0" step={scoreProfile.scoringMode === 'chess' ? '0.5' : '1'} max={scoreProfile.scoringMode === 'chess' ? 1 : scoreProfile.scoringMode === 'sets' ? 2 : undefined} value={palpiteA} disabled={saving} onChange={(event) => savedDraft.update('palpiteA', event.target.value)} required /></label>
      <span aria-hidden="true">×</span>
      <label>{game.timeB}<input type="number" inputMode={scoreProfile.scoringMode === 'chess' ? 'decimal' : 'numeric'} min="0" step={scoreProfile.scoringMode === 'chess' ? '0.5' : '1'} max={scoreProfile.scoringMode === 'chess' ? 1 : scoreProfile.scoringMode === 'sets' ? 2 : undefined} value={palpiteB} disabled={saving} onChange={(event) => savedDraft.update('palpiteB', event.target.value)} required /></label>
      <PredictionPlayerPicker game={game} value={topScorer} selectedName={prediction?.topScorerName} onChange={(value) => savedDraft.update('topScorer', value)} disabled={saving} />
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : prediction ? 'Atualizar' : 'Enviar'}</button>
    </form> : <div className="locked-note">{lockedMessage}{!user && onNavigate ? <button className="link-button" type="button" onClick={() => onNavigate('login')}>Entrar</button> : null}</div>}
    {message ? <div className={saveSucceeded ? 'alert alert-success' : 'alert alert-error'} role={saveSucceeded ? 'status' : 'alert'}>{message}</div> : null}
    <MatchDetailsDisclosure game={game} label="Detalhes e pontuação">
      <p><span>Placar</span><strong>{scoreProfile.scoringMode === 'sets' ? 'Melhor de 3 sets: 2 × 0, 2 × 1, 0 × 2 ou 1 × 2' : scoreLabel(game)}</strong></p>
      <p className="match-card-scoring"><span>Regra de pontuação</span><strong>{scoringRuleText}</strong></p>
    </MatchDetailsDisclosure>
    <PredictionStats game={game} now={now} />
  </article>
}
