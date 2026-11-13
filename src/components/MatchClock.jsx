import { useEffect, useState } from 'react'
import { controlMatchClock } from '../services/bolaoService.js'
import { clockRevision, formatMatchClock, matchClockValue } from '../utils/matchClock.js'
import { matchPeriod } from '../utils/matchPeriods.js'
import MatchPeriodControl from './MatchPeriodControl.jsx'

export function MatchClockDisplay({ game, now }) {
  const value = matchClockValue(game, now)
  const period = matchPeriod(game, now)
  return <div className={`match-clock${period.exceeded ? ' is-exceeded' : ''}${!value.running ? ' is-paused' : ''}`} aria-label="Cronômetro da partida"><span>{period.label || 'Tempo de jogo'}{!value.running && !period.interval ? ' · pausado' : ''}</span><strong>{formatMatchClock(period.supported ? period.elapsedMs : value.elapsedMs)}<small> / {formatMatchClock(period.supported ? period.durationMs : (Number(game.durationMinutes) || 30) * 60000)}</small></strong>{period.supported && period.number > 1 ? <span>Acumulado: {formatMatchClock(value.elapsedMs)}</span> : null}{period.exceeded ? <span>Duração prevista atingida</span> : null}</div>
}

export default function MatchClockControl({ game, disabled = false }) {
  const [now, setNow] = useState(() => new Date())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer) }, [])
  const value = matchClockValue(game, now)
  return <div className="match-clock-control"><MatchClockDisplay game={game} now={now} /><button type="button" className="btn btn-outline btn-small" disabled={disabled || busy || game.period?.phase === 'interval'} onClick={async () => {
    setBusy(true); setError('')
    try { await controlMatchClock({ gameId: game.id, action: value.running ? 'pause' : 'resume', expectedRevision: clockRevision(game) }) }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }}>{busy ? 'Atualizando…' : value.running ? 'Pausar cronômetro' : 'Retomar cronômetro'}</button><small>Pausar o cronômetro mantém a partida ao vivo e os palpites bloqueados. O término depende do responsável.</small>{error ? <p className="alert alert-error" role="alert">{error}</p> : null}<MatchPeriodControl game={game} disabled={disabled || busy} /></div>
}
