import { useEffect, useState } from 'react'
import { saveAnnouncement, setAnnouncementActive, subscribeAnnouncements, subscribeBroadcastSettings, saveBroadcastSettings } from '../services/bolaoService.js'
import { formatDateTime, toDate } from '../utils/format.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import { buildAutomaticCalls, DEFAULT_BROADCAST_SETTINGS } from '../utils/automaticCalls.js'
import { matchVenueLabel } from '../utils/matchVenue.js'

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
  const [text, setText] = useState('')
  const [type, setType] = useState('aviso')
  const [minutes, setMinutes] = useState(60)
  const [selectedGame, setSelectedGame] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer) }, [])
  useEffect(() => subscribeAnnouncements(setMessages, (error) => { setNotice(error); setFailed(true) }, true), [])
  const disabled = saving || parentSaving
  const act = async (action, message) => {
    setSaving(true); setNotice(''); setFailed(false)
    try { await action(); setNotice(message) } catch (error) { setFailed(true); setNotice(error.message) } finally { setSaving(false) }
  }
  const callableGames = games.filter((game) => [MATCH_STATE.SCHEDULED, MATCH_STATE.LIVE].includes(getMatchState(game)))
  const prepareCall = (id) => {
    setSelectedGame(id)
    const game = games.find((item) => item.id === id)
    if (!game) return
    setType('chamada')
    setText(`Atenção, ${game.timeA} e ${game.timeB}: preparem-se para a partida de ${game.esporteNome}${game.venue ? ` em ${matchVenueLabel(game)}` : ''}.`.slice(0, 240))
  }
  return <section className="broadcast-admin" aria-label="Avisos e chamadas da TV"><div className="section-heading"><div><span className="eyebrow">Comunicação do Interclasse</span><h2>Avisos e chamadas da TV</h2><p>Publique chamadas de equipes, atrasos e mudanças de local para os alunos.</p></div></div><AutomaticCallsSettings games={games} /><label>Preparar chamada de uma partida<select value={selectedGame} onChange={(event) => prepareCall(event.target.value)}><option value="">Selecione para preencher a mensagem</option>{callableGames.map((game) => <option key={game.id} value={game.id}>{game.esporteNome} · {game.timeA} × {game.timeB}{game.venue ? ` · ${game.venue}` : ''}</option>)}</select></label><form className="broadcast-form" onSubmit={(event) => { event.preventDefault(); act(async () => { await saveAnnouncement({ text, type, minutes }); setText(''); setSelectedGame('') }, 'Aviso publicado na TV com sucesso.') }}><div className="form-grid"><label>Tipo<select value={type} disabled={disabled} onChange={(event) => setType(event.target.value)}><option value="aviso">Aviso</option><option value="chamada">Chamada de equipes</option><option value="atraso">Atraso / mudança</option></select></label><label>Tempo na TV<select value={minutes} disabled={disabled} onChange={(event) => setMinutes(Number(event.target.value))}>{[15, 30, 60, 120, 240, 1440].map((value) => <option key={value} value={value}>{value < 60 ? `${value} minutos` : `${value / 60} hora(s)`}</option>)}</select></label></div><label>Mensagem para os alunos<textarea required maxLength="240" rows="3" value={text} disabled={disabled} onChange={(event) => setText(event.target.value)} placeholder="Ex.: Turmas 8º A e 8º B, dirijam-se à Quadra 2." /></label><small>{text.length}/240 caracteres</small><button className="btn btn-primary" type="submit" disabled={disabled}>{saving ? 'Publicando…' : 'Publicar na TV'}</button></form>{notice ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{notice}</div> : null}<div className="broadcast-history">{messages.map((message) => {
    const expired = toDate(message.expiresAt).getTime() <= now
    return <article key={message.id}><div><span className="eyebrow">{message.type} · {!message.active ? 'Oculto' : expired ? 'Expirado' : 'Na TV'}</span><strong>{message.text}</strong><small>Até {formatDateTime(message.expiresAt)}</small></div><div className="form-actions"><button className="btn btn-outline btn-small" type="button" disabled={disabled || expired} onClick={() => act(() => setAnnouncementActive(message.id, !message.active), 'Aviso atualizado com sucesso.')}>{message.active ? 'Ocultar' : 'Exibir'}</button><button className="btn btn-ghost btn-small" type="button" disabled={disabled} onClick={() => onDelete(message)}>Remover</button></div></article>
  })}</div></section>
}
