import { useEffect, useRef, useState } from 'react'
import { saveAnnouncement, setAnnouncementActive, subscribeAnnouncements, subscribeBroadcastSettings, saveBroadcastSettings, subscribeTVAnnouncement } from '../services/bolaoService.js'
import { formatDateTime, toDate } from '../utils/format.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import { buildAutomaticCalls, DEFAULT_BROADCAST_SETTINGS } from '../utils/automaticCalls.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import { eventDate, SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import { activeTVAnnouncement, TV_ANNOUNCEMENT_TYPES } from '../utils/tvAnnouncements.js'

const gameTime = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, hour: '2-digit', minute: '2-digit' })

function AutomaticCallsSettings({ games }) {
  const [settings, setSettings] = useState(DEFAULT_BROADCAST_SETTINGS)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => subscribeBroadcastSettings(setSettings, (error) => { setMessage(error); setFailed(true) }), [])
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer) }, [])
  const value = draft || settings
  const calls = buildAutomaticCalls(games, settings, now)
  return <form className="automatic-calls-settings" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage(''); setFailed(false)
    try { await saveBroadcastSettings(value); setDraft(null); setMessage('Configurações da TV atualizadas.') } catch (error) { setFailed(true); setMessage(error.message) } finally { setBusy(false) }
  }}><fieldset disabled={busy}><legend>Chamadas automáticas antes dos jogos</legend><label className="match-checkbox"><input type="checkbox" checked={value.autoCallsEnabled} onChange={(event) => setDraft({ ...value, autoCallsEnabled: event.target.checked })} />Ativar chamadas automáticas na TV</label><label>Antecedência da chamada<select value={value.leadMinutes} onChange={(event) => setDraft({ ...value, leadMinutes: Number(event.target.value) })}>{[5, 10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos antes</option>)}</select></label><label className="match-checkbox"><input type="checkbox" checked={value.showMatchClock !== false} onChange={(event) => setDraft({ ...value, showMatchClock: event.target.checked })} />Exibir cronômetros das partidas ao vivo na TV</label><p>A TV chama as duas equipes pelo nome, com esporte, local e horário. A chamada sai ao iniciar a partida ou atingir o horário programado. Jogos adiados, cancelados ou com equipes a definir ficam fora.</p><button className="btn btn-primary" type="submit">{busy ? 'Salvando…' : 'Salvar configurações da TV'}</button></fieldset><div className="automatic-calls-preview"><strong>{calls.length} chamada(s) automática(s) em exibição agora</strong>{calls.slice(0, 8).map((call) => <p key={call.id}>{call.text}</p>)}{!calls.length ? <p>As chamadas aparecerão quando os próximos jogos entrarem na antecedência configurada.</p> : null}</div>{message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}</form>
}

export default function BroadcastAdmin({ games, onDelete, saving: parentSaving }) {
  const [messages, setMessages] = useState([])
  const [broadcast, setBroadcast] = useState(null)
  const [text, setText] = useState('')
  const [type, setType] = useState('aviso')
  const [selectedGame, setSelectedGame] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const busy = useRef(false)
  const messageInput = useRef(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const reportError = (error) => { if (error) { setNotice(error); setFailed(true) } }
    const stopHistory = subscribeAnnouncements(setMessages, reportError, true)
    const stopBroadcast = subscribeTVAnnouncement(setBroadcast, reportError)
    return () => { stopHistory(); stopBroadcast() }
  }, [])

  const disabled = saving || parentSaving
  const currentId = activeTVAnnouncement(broadcast, now)?.id
  const act = async (action, message) => {
    if (busy.current || parentSaving) return
    busy.current = true
    setSaving(true)
    setNotice('')
    setFailed(false)
    try {
      await action()
      setNotice(message)
    } catch (error) {
      setFailed(true)
      setNotice(error.message)
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  const callableGames = games.filter((game) => !game.seedLabelA && !game.seedLabelB && [MATCH_STATE.SCHEDULED, MATCH_STATE.LIVE].includes(getMatchState(game)))
  const prepareCall = (id) => {
    setSelectedGame(id)
    const game = games.find((item) => item.id === id)
    if (!game) return
    const start = eventDate(game.dataHora)
    const time = getMatchState(game) === MATCH_STATE.SCHEDULED && Number.isFinite(start.getTime()) ? ` às ${gameTime.format(start)}` : ''
    const venue = matchVenueLabel(game)
    setType('chamada')
    setText(`${game.timeA} e ${game.timeB}, preparem-se para a partida de ${game.esporteNome}${time}${venue ? ` em ${venue}` : ''}.`.slice(0, 240))
  }

  const publish = (event) => {
    event.preventDefault()
    void act(async () => {
      await saveAnnouncement({ text, type })
      setText('')
      setSelectedGame('')
    }, 'Aviso publicado na TV.')
  }

  const reuse = (message) => {
    setSelectedGame('')
    setType(message.type)
    setText(message.text)
    messageInput.current?.focus()
  }

  return <section className="broadcast-admin" aria-label="Avisos e chamadas da TV">
    <div className="section-heading">
      <div><h2>Avisos e chamadas da TV</h2><p>O aviso ocupa a tela por 30 segundos. Com a sirene ativada na TV, ela toca por 5 segundos.</p></div>
    </div>
    <form className="broadcast-form" onSubmit={publish}>
      <div className="form-grid">
        <label>Preparar chamada de uma partida
          <select value={selectedGame} disabled={disabled} onChange={(event) => prepareCall(event.target.value)}>
            <option value="">Selecione para preencher a mensagem</option>
            {callableGames.map((game) => <option key={game.id} value={game.id}>{game.esporteNome} · {game.timeA} × {game.timeB}{game.venue ? ` · ${game.venue}` : ''}</option>)}
          </select>
        </label>
        <label>Tipo
          <select value={type} disabled={disabled} onChange={(event) => setType(event.target.value)}>
            {Object.entries(TV_ANNOUNCEMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label>Mensagem para os alunos
        <textarea ref={messageInput} required maxLength="240" rows="3" value={text} disabled={disabled} onChange={(event) => setText(event.target.value)} placeholder="Turmas 8º A e 8º B, dirijam-se à Quadra 2." />
      </label>
      <small>{text.length}/240 caracteres{currentId ? ' · Um novo aviso substitui o que está na tela.' : ''}</small>
      <button className="btn btn-primary" type="submit" disabled={disabled || !text.trim()}>{saving ? 'Publicando…' : 'Publicar na TV'}</button>
    </form>
    {notice ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{notice}</div> : null}
    <AutomaticCallsSettings games={games} />
    <div className="broadcast-history">
      {messages.map((message) => {
        const isScreen = message.presentation === 'screen'
        const onScreen = message.id === currentId
        const expired = toDate(message.expiresAt).getTime() <= now
        const status = isScreen ? onScreen ? 'Na TV' : 'Encerrado' : !message.active ? 'Oculto' : expired ? 'Expirado' : 'Na faixa de avisos'
        return <article key={message.id}>
          <div><span className="eyebrow">{TV_ANNOUNCEMENT_TYPES[message.type] || 'Aviso'} · {status}</span><strong>{message.text}</strong><small>{isScreen ? formatDateTime(message.createdAt) : `Até ${formatDateTime(message.expiresAt)}`}</small></div>
          <div className="form-actions">
            {onScreen ? <button className="btn btn-outline btn-small" type="button" disabled={disabled} onClick={() => act(() => setAnnouncementActive(message.id, false), 'Aviso encerrado.')}>Encerrar aviso</button>
              : isScreen ? <button className="btn btn-outline btn-small" type="button" disabled={disabled} onClick={() => reuse(message)}>Reutilizar mensagem</button>
                : <button className="btn btn-outline btn-small" type="button" disabled={disabled || expired} onClick={() => act(() => setAnnouncementActive(message.id, !message.active), 'Aviso atualizado.')}>{message.active ? 'Ocultar' : 'Exibir'}</button>}
            <button className="btn btn-ghost btn-small" type="button" disabled={disabled} onClick={() => onDelete(message)}>Remover</button>
          </div>
        </article>
      })}
    </div>
  </section>
}
