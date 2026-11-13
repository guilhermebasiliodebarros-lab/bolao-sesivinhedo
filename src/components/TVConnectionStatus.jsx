import { useEffect, useId, useRef, useState } from 'react'
import { refreshRealtimeSubscriptions } from '../services/realtime.js'
import { confirmationAge } from '../utils/transmissionHealth.js'
import './TVConnectionStatus.css'

const time = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))

export default function TVConnectionStatus({ health, now, compact = false }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const dialog = useRef(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    dialog.current.showModal()
    const element = dialog.current
    return () => element.close()
  }, [open])
  return <div className={`tv-health is-${health.state}${compact ? ' is-compact' : ''}`}>
    <button type="button" className="tv-health-trigger" title={`Diagnóstico da TV: ${health.label}`} aria-label={`Diagnóstico da TV: ${health.label}`} onClick={() => { setMessage(''); setOpen(true) }}><span className="tv-health-dot" /><span className="tv-health-label">{health.label}</span>{health.lastServerAt ? <span className="tv-health-age">· conferido há {confirmationAge(now.getTime() - health.lastServerAt)}</span> : null}</button>
    <dialog className="tv-health-dialog" ref={dialog} aria-labelledby={titleId} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header><div><span>TRANSMISSÃO DO INTERCLASSE</span><h2 id={titleId}>Diagnóstico da TV</h2></div><button type="button" aria-label="Fechar diagnóstico" onClick={() => setOpen(false)}>×</button></header>
      <strong className={`tv-health-status is-${health.state}`}>{health.label}</strong>
      <p>Esta tela confere os dados com o servidor, mesmo quando não há novos lances. Se a confirmação demorar, o aviso muda e os últimos placares permanecem visíveis.</p>
      <dl>{health.feeds.map((feed) => <div key={feed.name}><dt>{feed.name}</dt><dd>{feed.lastServerAt ? <>{time(feed.lastServerAt)} · há {confirmationAge(feed.ageMs)}{feed.stale ? ' · atrasado' : ''}</> : 'Aguardando primeira confirmação'}</dd></div>)}</dl>
      <p>O cronômetro continua sendo calculado na tela. Ele se mover não confirma que a conexão está funcionando.</p>
      <div className="tv-health-actions"><button type="button" disabled={health.state === 'offline'} onClick={() => { refreshRealtimeSubscriptions(); setMessage('Conferência solicitada. Aguarde a confirmação do servidor acima.') }}>Verificar conexão agora</button><button type="button" onClick={() => window.location.reload()}>Recarregar tela</button></div>
      {message ? <p role="status">{message}</p> : null}
    </dialog>
  </div>
}
