import { useId, useMemo, useRef, useState } from 'react'
import useModalDialog from '../hooks/useModalDialog.js'
import usePredictionClock from '../hooks/usePredictionClock.js'
import { applyScheduleDelay } from '../services/bolaoService.js'
import { buildDelayImpact, delayPlanFingerprint, delayScheduleFingerprint } from '../utils/scheduleDelay.js'
import { canScheduleGame } from '../utils/visualSchedule.js'
import { formatCalendarDay, formatCalendarTime, sortCalendarGames } from '../utils/calendarExplorer.js'
import { eventDate, schoolDay } from '../utils/tvSchedule.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import { predictionDeadlineInput } from '../utils/predictionDeadline.js'
import { getGameShift, shiftLabel } from '../utils/schoolShifts.js'
import './DelayImpactDialog.css'

export default function DelayImpactDialog({ games, teams, candidates, day, onClose, onSaved }) {
  const ref = useRef(null), titleId = useId(), descriptionId = useId()
  const [source, setSource] = useState(() => ({ games, teams }))
  const [anchorId, setAnchorId] = useState(() => sortCalendarGames(candidates).find((game) => canScheduleGame(game) && schoolDay(game.dataHora) === day)?.id || '')
  const [minutes, setMinutes] = useState('15')
  const [accepted, setAccepted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const now = usePredictionClock(games)
  useModalDialog(ref)

  const sourceSignature = useMemo(() => delayScheduleFingerprint(source.games, source.teams), [source])
  const stale = sourceSignature !== delayScheduleFingerprint(games, teams)
  const available = sortCalendarGames(source.games.filter((game) => candidates.some((candidate) => candidate.id === game.id) && canScheduleGame(game) && schoolDay(game.dataHora) === day))
  let plan = null, inputError = ''
  try { plan = buildDelayImpact(source.games, source.teams, { anchorId, minutes, now }) } catch (failure) { inputError = failure.message }
  const signature = plan ? delayPlanFingerprint(plan) : ''
  const blocked = busy || stale || Boolean(inputError) || !plan?.changes.length || plan.issues.length > 0 || accepted !== signature
  const update = (setter, value) => { setter(value); setAccepted(''); setError('') }
  const refresh = () => { setSource({ games, teams }); setAccepted(''); setError('') }

  return <dialog ref={ref} className="match-management-dialog delay-impact-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="match-management-heading">
      <div><span className="eyebrow">Programação · {formatCalendarDay(day, { weekday: undefined, month: 'short' })}</span><h2 id={titleId}>Simular impacto de atraso</h2><p id={descriptionId}>Confira o que muda nos jogos seguintes antes de aplicar à agenda.</p></div>
      <button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={onClose}>Fechar</button>
    </div>
    <form onSubmit={async (event) => {
      event.preventDefault()
      if (blocked) return
      setBusy(true); setError('')
      try {
        const result = await applyScheduleDelay({ anchorId, minutes: Number(minutes), expectedSchedule: sourceSignature, expectedPlan: signature })
        onSaved(`${result.changed} horário(s) ajustado(s). Calendário e TV atualizados; confira a preparação das partidas antes de iniciar.`)
      } catch (failure) { setError(failure.message) } finally { setBusy(false) }
    }}>
      <fieldset disabled={busy}>
        <legend>Defina o atraso</legend>
        <div className="delay-impact-fields">
          <label>Partida que começará mais tarde<select autoFocus required value={anchorId} onChange={(event) => update(setAnchorId, event.target.value)}><option value="">Escolha a partida</option>{available.map((game) => <option key={game.id} value={game.id}>{formatCalendarTime(game.dataHora)} · {game.timeA} × {game.timeB} · {game.esporteNome}</option>)}</select></label>
          <label>Atraso mínimo (minutos)<input type="number" inputMode="numeric" min="1" max="240" step="1" required value={minutes} onChange={(event) => update(setMinutes, event.target.value)} /></label>
        </div>
        <div className="delay-presets" role="group" aria-label="Sugestões de atraso">{[5, 10, 15, 30, 60].map((value) => <button type="button" key={value} className={Number(minutes) === value ? 'is-active' : ''} aria-pressed={Number(minutes) === value} onClick={() => update(setMinutes, String(value))}>+{value} min</button>)}</div>
      </fieldset>
      <p className="form-hint">A simulação considera quadras, áreas, turmas e fases anteriores, inclusive jogos de outras modalidades e turnos. Intervalos livres absorvem o atraso quando possível. As durações são as previstas na agenda; horários com segundos são arredondados para o minuto seguinte.</p>
      {stale ? <div className="alert alert-error" role="alert"><p>A agenda mudou durante a simulação. Atualize para conferir os horários atuais.</p><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={refresh}>Atualizar prévia</button></div> : null}
      {inputError ? <p className="alert alert-error" role="status">{inputError}</p> : null}
      {plan ? <>
        <div className="delay-impact-summary" aria-label="Resumo do impacto"><article><span>Partidas afetadas</span><strong>{plan.changes.length}</strong></article><article><span>Maior ajuste</span><strong>+{plan.maxDelay} <small>min</small></strong></article><article><span>Jogos preservados</span><strong>{source.games.filter((game) => schoolDay(game.dataHora) === day).length - plan.changes.length}</strong></article></div>
        {plan.issues.length ? <div className="schedule-warning delay-impact-issues" role="status"><strong>Resolva estes pontos antes de aplicar</strong><ul>{plan.issues.slice(0, 8).map((issue, index) => <li key={`${issue.id}-${index}`}>{issue.message}</li>)}</ul>{plan.issues.length > 8 ? <p>Há mais {plan.issues.length - 8} aviso(s). Revise os jogos afetados na agenda.</p> : null}</div> : null}
        {plan.changes.length ? <div className="delay-impact-list" aria-label="Comparação dos horários">{plan.changes.map(({ game, after, minutes: delta, reasons }) => <article key={game.id} data-delay-game={game.id}>
          <div className="delay-impact-match"><span>{game.esporteNome} · {shiftLabel(getGameShift(game))}</span><strong>{game.timeA} × {game.timeB}</strong><small>{matchVenueLabel(game) || 'Local a definir'} · {reasons.join(' / ')}</small></div>
          <div className="delay-impact-times"><span><small>Atual</small><time dateTime={eventDate(game.dataHora).toISOString()}>{formatCalendarTime(game.dataHora)}</time></span><i aria-hidden="true">→</i><span><small>Proposto</small><time dateTime={eventDate(after.dataHora).toISOString()}>{schoolDay(after.dataHora) !== day ? `${formatCalendarDay(schoolDay(after.dataHora), { weekday: undefined, month: 'short' })} · ` : ''}{formatCalendarTime(after.dataHora)}</time></span><b>+{delta} min</b></div>
          <p>Palpites até <strong>{formatCalendarTime(predictionDeadlineInput(after))}</strong>{game.status === 'encerrado' ? ' · permanecem bloqueados pela organização' : ''}</p>
        </article>)}</div> : null}
        <div className="delay-impact-confirmation"><p>Somente os horários propostos serão alterados. As partidas afetadas precisarão de uma nova conferência antes de iniciar. Os prazos de palpites acompanham os horários.</p><label className="match-checkbox"><input type="checkbox" checked={accepted === signature && Boolean(signature)} disabled={busy || stale || plan.issues.length > 0 || !plan.changes.length} onChange={(event) => setAccepted(event.target.checked ? signature : '')} />Conferi as partidas e os novos horários desta prévia.</label></div>
      </> : null}
      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={blocked}>{busy ? 'Aplicando horários…' : 'Aplicar horários da prévia'}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Voltar sem alterar</button></div>
    </form>
  </dialog>
}
