import { useRef, useState } from 'react'
import { changeMatchPeriod } from '../services/bolaoService.js'
import { clockRevision } from '../utils/matchClock.js'
import { matchPeriod, PERIOD_FORMATS, periodLabel } from '../utils/matchPeriods.js'
import './MatchOperationTools.css'

export default function MatchPeriodControl({ game, disabled = false }) {
  const period = matchPeriod(game)
  const [formatDraft, setFormat] = useState(null)
  const format = formatDraft || period.format
  const [review, setReview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  if (!period.supported) return null
  const stale = review && (review.expectedRevision !== period.revision || review.expectedClockRevision !== clockRevision(game))
  const propose = (action) => { setError(''); setReview({ action, format, expectedRevision: period.revision, expectedClockRevision: clockRevision(game) }) }
  const confirmLabel = review?.action === 'interval' ? 'Confirmar intervalo' : review?.action === 'next' ? `Iniciar ${periodLabel(period.number + 1, period.format)}` : 'Confirmar formato'
  return <section className={`match-period-control${period.interval ? ' is-interval' : ''}`} aria-label="Períodos da partida">
    <div className="section-heading"><div><span className="eyebrow">Controle de períodos</span><h4>{period.label}</h4></div><span>{period.number} / {period.total}</span></div>
    <p>O responsável controla as trocas. O tempo acumulado e os minutos dos lances são preservados.</p>
    {!review ? <div className="form-actions">
      {period.number === 1 && !period.interval ? <><label>Formato da partida<select value={format} disabled={disabled || busy} onChange={(event) => setFormat(event.target.value)}>{Object.entries(PERIOD_FORMATS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="btn btn-outline btn-small" disabled={disabled || busy || format === period.format} onClick={() => propose('format')}>Aplicar formato</button></> : null}
      {period.number < period.total ? <button type="button" className="btn btn-primary" disabled={disabled || busy} onClick={() => propose(period.interval ? 'next' : 'interval')}>{period.interval ? `Preparar ${periodLabel(period.number + 1, period.format)}` : `Encerrar ${periodLabel(period.number, period.format)}`}</button> : <small>Último período. Use Encerrar partida ao concluir o jogo.</small>}
    </div> : <div className="match-action-review"><strong>{review.action === 'interval' ? 'Iniciar intervalo e pausar o relógio?' : review.action === 'next' ? `Começar o ${periodLabel(period.number + 1, period.format)} e retomar o relógio?` : `Usar ${PERIOD_FORMATS[review.format]} nesta partida?`}</strong>
      {stale ? <p role="alert">O período ou o relógio mudou. Volte e confira a atualização.</p> : null}
      <div className="form-actions"><button type="button" className="btn btn-primary" disabled={disabled || busy || stale} onClick={async () => {
        if (lock.current) return
        lock.current = true; setBusy(true); setError('')
        try { await changeMatchPeriod({ gameId: game.id, ...review }); setReview(null); setFormat(null) } catch (failure) { setError(failure.message) } finally { lock.current = false; setBusy(false) }
      }}>{busy ? 'Atualizando…' : confirmLabel}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReview(null)}>Voltar</button></div>
    </div>}
    {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
  </section>
}
