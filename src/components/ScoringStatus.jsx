import { useEffect, useState } from 'react'
import { recalculateScores, subscribeScoringStatus } from '../services/bolaoService.js'
import { formatNoticeDate } from '../utils/scheduleNotices.js'

export default function ScoringStatus({ admin = false }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => subscribeScoringStatus(setStatus, setError), [])
  if (!admin && status?.status !== 'processing' && status?.status !== 'error') return null
  return <section className={admin ? 'server-scoring-panel' : 'scoring-status-note'} aria-label="Apuração automática"><div><span className="eyebrow">Classificação dos professores</span><h2>{admin ? 'Apuração automática no servidor' : status?.status === 'error' ? 'A classificação está sendo conferida' : 'Atualizando a classificação…'}</h2><p>{admin ? 'Resultados, correções e aprovações disparam a apuração no Firebase. O processamento continua quando o navegador é fechado.' : 'Os pontos serão atualizados automaticamente após o processamento.'}</p>{admin ? <p>Última conclusão: {status?.completedAt ? formatNoticeDate(status.completedAt) : 'Aguardando a primeira apuração'} · {status?.status === 'processing' ? 'Processando' : status?.status === 'error' ? 'Nova tentativa pendente' : 'Em dia'}</p> : null}</div>{admin ? <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await recalculateScores() } catch (requestError) { setError(requestError.message) } finally { setBusy(false) } }}>{busy ? 'Apurando…' : 'Recalcular agora'}</button> : null}{admin && error ? <p role="alert" className="alert alert-error">{error}</p> : null}</section>
}
