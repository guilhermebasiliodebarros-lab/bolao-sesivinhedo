import { useEffect, useRef, useState } from 'react'
import { endTVRehearsalAnnouncement, saveAnnouncement, subscribeTVAnnouncement, toFriendlyError } from '../services/bolaoService.js'
import { toDate } from '../utils/format.js'
import { REHEARSAL_TV_VIEW } from '../utils/navigation.js'
import { activeTVAnnouncement, TV_ANNOUNCEMENT_TYPES } from '../utils/tvAnnouncements.js'

const link = `/#${REHEARSAL_TV_VIEW}`
const initialMessage = 'Ensaio da comissão. Equipes de teste, preparem-se para a próxima partida na quadra principal.'
const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function RehearsalTVControl() {
  const [type, setType] = useState('chamada')
  const [text, setText] = useState(initialMessage)
  const [latest, setLatest] = useState(null)
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [action, setAction] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const busy = useRef(false)

  useEffect(() => subscribeTVAnnouncement(
    (notice) => { setLatest(notice); setNow(Date.now()) },
    setConnectionError,
    (ready) => { setConnected(ready); if (ready) setConnectionError('') },
    { rehearsal: true },
  ), [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const active = activeTVAnnouncement(latest, now)
  const receipt = latest?.receipt
  const sentAt = toDate(latest?.publishedAt)
  const receiptStatus = receipt?.sirenStarted ? 'A TV de ensaio recebeu o aviso e acionou a sirene.'
    : receipt ? 'A TV de ensaio recebeu o aviso. Ative a sirene na TV e repita o teste.'
      : active ? 'Aviso enviado. Aguardando a confirmação da TV de ensaio.'
        : 'O aviso expirou. Confira se a TV de ensaio está aberta e envie novamente.'
  const disabled = Boolean(action) || !connected || Boolean(connectionError)

  const run = async (name, request) => {
    if (busy.current || disabled) return
    busy.current = true
    setAction(name)
    setFeedback(null)
    try {
      const message = await request()
      if (message) setFeedback({ text: message })
    } catch (error) {
      setFeedback({ text: toFriendlyError(error), error: true })
    } finally {
      busy.current = false
      setAction('')
    }
  }

  const send = (event) => {
    event.preventDefault()
    void run('send', async () => { await saveAnnouncement({ text, type, rehearsal: true }) })
  }

  const end = () => run('end', async () => {
    const removed = await endTVRehearsalAnnouncement(active.id)
    return removed ? 'Aviso de teste encerrado.' : 'O aviso já mudou. Confira o último teste enviado.'
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(link, window.location.href).href)
      setFeedback({ text: 'Link da TV de ensaio copiado.' })
    } catch {
      setFeedback({ text: 'Abra a TV de ensaio e copie o endereço pelo navegador.', error: true })
    }
  }

  return <section className="rehearsal-setup rehearsal-tv-control" aria-labelledby="rehearsal-tv-heading">
    <div>
      <h3 id="rehearsal-tv-heading">Testar avisos da TV</h3>
      <p>Abra a TV de ensaio no computador ligado à TV com a conta da organização. Clique em <strong>Ativar sirene</strong> nela e envie o aviso daqui.</p>
      <p>O aviso ocupa a tela por 30 segundos e usa a sirene de 5 segundos. Os jogos são fictícios. Quando terminar, use <strong>Abrir Modo TV oficial</strong> na TV.</p>
    </div>
    <div className="form-actions">
      <a className="btn btn-outline" href={link} target="_blank" rel="noreferrer">Abrir TV de ensaio</a>
      <button className="btn btn-outline" type="button" onClick={copy}>Copiar link da TV de ensaio</button>
    </div>
    <form className="broadcast-form" onSubmit={send}>
      <label>Tipo de aviso de teste
        <select value={type} disabled={Boolean(action)} onChange={(event) => setType(event.target.value)}>
          {Object.entries(TV_ANNOUNCEMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Mensagem de teste
        <textarea rows="3" required maxLength={240} value={text} disabled={Boolean(action)} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={disabled || !text.trim()}>{action === 'send' ? 'Enviando…' : 'Enviar aviso de teste'}</button>
        {active ? <button className="btn btn-outline" type="button" disabled={disabled} onClick={end}>{action === 'end' ? 'Encerrando…' : 'Encerrar aviso de teste'}</button> : null}
      </div>
    </form>
    {!connected || connectionError ? <p role="status">{connectionError || 'Aguardando conexão com o servidor de avisos.'}</p> : null}
    {latest ? <div className={`alert${receipt?.sirenStarted ? ' alert-success' : ''}`} role="status">
      <strong>{receiptStatus}</strong>
      {Number.isFinite(sentAt.getTime()) ? <span> Enviado às {timeFormat.format(sentAt)}.</span> : null}
    </div> : null}
    {feedback ? <div className={`alert ${feedback.error ? 'alert-error' : 'alert-success'}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</div> : null}
  </section>
}
