import { useEffect, useState } from 'react'
import { markScheduleNoticesRead, subscribeScheduleNoticeReads, subscribeScheduleNotices, subscribeUserPredictions } from '../services/bolaoService.js'
import { formatNoticeDate, scheduleConditionLabel, unreadScheduleNotices } from '../utils/scheduleNotices.js'

const venue = (value) => [value.venue, value.venueArea].filter(Boolean).join(' · ') || 'Local a definir'

export default function ScheduleNotices({ userId, onNavigate }) {
  const [notices, setNotices] = useState([])
  const [readIds, setReadIds] = useState([])
  const [predictions, setPredictions] = useState([])
  const [ready, setReady] = useState({ notices: false, reads: false })
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const stopNotices = subscribeScheduleNotices((items) => { setNotices(items); setReady((value) => ({ ...value, notices: true })) }, setError)
    const stopReads = subscribeScheduleNoticeReads(userId, (items) => { setReadIds(items); setReady((value) => ({ ...value, reads: true })) }, setError)
    const stopPredictions = subscribeUserPredictions(userId, setPredictions)
    return () => { stopNotices(); stopReads(); stopPredictions() }
  }, [userId])
  const unread = ready.notices && ready.reads ? unreadScheduleNotices(notices, readIds) : []
  const ownGames = new Set(predictions.map((prediction) => prediction.gameId))
  const markRead = async () => {
    if (busy) return
    if (navigator.onLine === false) { setError('Aguarde a conexão voltar para marcar os avisos como lidos.'); return }
    setBusy(true); setError('')
    try { setReadIds(await markScheduleNoticesRead(userId, readIds, notices.map((notice) => notice.id))) }
    catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }
  return <aside className="schedule-notices" aria-label="Novidades da programação">
    <button type="button" className="schedule-notices-toggle" aria-expanded={expanded} aria-controls="schedule-notices-content" onClick={() => setExpanded((value) => !value)}><span>Novidades do evento</span><span className={unread.length ? 'notice-count has-unread' : 'notice-count'} aria-live="polite">{unread.length ? `${unread.length} não lida(s)` : ready.notices && ready.reads ? 'Tudo em dia' : 'Carregando…'}</span><span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    {error ? <p className="schedule-notices-error" role="status">{error}</p> : null}
    {expanded ? <div id="schedule-notices-content" className="schedule-notices-content">
      <div className="schedule-notices-actions"><p>Últimas 50 atualizações de horário, local e situação das partidas, no horário de São Paulo. Seus palpites enviados são preservados.</p><button type="button" className="btn btn-outline btn-small" disabled={busy || !unread.length} onClick={markRead}>{busy ? 'Marcando…' : 'Marcar todas como lidas'}</button></div>
      {!notices.length && ready.notices ? <p>Nenhuma alteração publicada até agora.</p> : null}
      <div className="schedule-notices-list">{notices.map((notice) => <article key={notice.id} className={readIds.includes(notice.id) ? 'schedule-notice' : 'schedule-notice is-unread'}>
        <div className="schedule-notice-heading"><strong>{notice.changes?.length === 1 ? 'Programação atualizada' : `${notice.changes?.length || 0} partidas atualizadas`}</strong><time>{formatNoticeDate(notice.createdAt)}</time></div>
        {(notice.changes || []).map((change) => <div key={change.gameId} className="schedule-notice-change"><p><strong>{change.timeA} × {change.timeB}</strong><span>{change.esporteNome}{ownGames.has(change.gameId) ? ' · Você enviou palpite' : ''}</span></p>
          {change.fields.includes('time') ? <dl><dt>Horário</dt><dd><span>{change.previous.dateTime ? formatNoticeDate(change.previous.dateTime) : 'A definir'}</span><span aria-hidden="true"> → </span><strong>{change.current.dateTime ? formatNoticeDate(change.current.dateTime) : 'A definir'}</strong></dd></dl> : null}
          {change.fields.includes('venue') ? <dl><dt>Local</dt><dd><span>{venue(change.previous)}</span><span aria-hidden="true"> → </span><strong>{venue(change.current)}</strong></dd></dl> : null}
          {change.fields.includes('condition') ? <dl><dt>Situação</dt><dd><span>{scheduleConditionLabel(change.previous.condition)}</span><span aria-hidden="true"> → </span><strong>{scheduleConditionLabel(change.current.condition)}</strong></dd></dl> : null}
        </div>)}
      </article>)}</div>
      {notices.length ? <button type="button" className="btn btn-secondary btn-small" onClick={() => onNavigate('jogos')}>Conferir jogos e palpites</button> : null}
    </div> : null}
  </aside>
}
