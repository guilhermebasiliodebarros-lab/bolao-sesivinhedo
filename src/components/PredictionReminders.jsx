import { useEffect, useRef, useState } from 'react'
import { subscribeGames, subscribeUserPredictions } from '../services/bolaoService.js'
import usePredictionClock from '../hooks/usePredictionClock.js'
import { claimReminder, reminderCandidates, reminderId, reminderPreferenceKey } from '../utils/predictionReminders.js'
import { readPreference, writePreference } from '../utils/preferences.js'
import { automaticPredictionDeadline } from '../utils/predictionDeadline.js'
import { formatDateTime } from '../utils/format.js'

export default function PredictionReminders({ userId, showSettings, onNavigate }) {
  const key = reminderPreferenceKey(userId)
  const [lead, setLead] = useState(() => [5, 10, 15].includes(Number(readPreference(key))) ? Number(readPreference(key)) : 0)
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [ready, setReady] = useState({ games: false, predictions: false })
  const [notices, setNotices] = useState([])
  const [error, setError] = useState('')
  const [permission, setPermission] = useState(() => 'Notification' in window ? Notification.permission : 'unsupported')
  const seen = useRef(new Set())
  const now = usePredictionClock(lead ? games : [])
  useEffect(() => {
    if (!lead) return
    const failed = (message) => setError(message)
    const sync = (field) => (connected) => { setReady((current) => ({ ...current, [field]: connected })); if (connected) setError('') }
    const stopGames = subscribeGames(setGames, failed, sync('games'))
    const stopPredictions = subscribeUserPredictions(userId, setPredictions, failed, sync('predictions'))
    return () => { stopGames(); stopPredictions() }
  }, [lead, userId])

  useEffect(() => {
    if (!lead || !ready.games || !ready.predictions) return
    let active = true
    const notify = async () => {
      for (const game of reminderCandidates(games, predictions, now, lead)) {
        const claim = () => {
          if (!active || !reminderCandidates([game], predictions, new Date(), lead).length || !claimReminder(userId, game, new Date(), undefined, seen.current)) return
          const id = reminderId(game)
          setNotices((current) => [...current, id])
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notification = new Notification('Seu palpite ainda não foi enviado', { body: `${game.timeA} × ${game.timeB} · ${game.esporteNome}. Fecha em ${formatDateTime(automaticPredictionDeadline(game))}.`, tag: `${key}:${id}`, icon: '/logo-interclasse.png' })
              notification.onclick = () => { window.focus(); onNavigate('jogos'); notification.close() }
            } catch { /* Some mobile browsers only support service-worker notifications. */ }
          }
        }
        if (navigator.locks) await navigator.locks.request(`${key}:claim`, claim)
        else claim()
      }
    }
    notify().catch(() => {})
    return () => { active = false }
  }, [games, key, lead, now, onNavigate, predictions, ready, userId])

  const changeLead = (value) => { setLead(value); writePreference(key, String(value)); setNotices([]); setReady({ games: false, predictions: false }) }
  const requestPermission = async () => {
    try { setPermission(await Notification.requestPermission()) } catch { setPermission('denied') }
  }
  const pending = lead ? reminderCandidates(games, predictions, now, lead).filter((game) => notices.includes(reminderId(game))) : []
  return <div className="participant-reminders">
    {showSettings ? <section className="reminder-settings" aria-label="Lembretes de palpites">
      <div><strong>Lembretes de palpites</strong><p>Avise antes do fechamento, que ocorre 5 minutos antes do jogo. Funciona enquanto o site estiver aberto neste navegador.</p></div>
      <label>Quando avisar<select value={lead} onChange={(event) => changeLead(Number(event.target.value))}><option value="0">Desativados</option>{[5, 10, 15].map((minutes) => <option key={minutes} value={minutes}>{minutes} min antes de fechar</option>)}</select></label>
      {lead > 0 && permission === 'default' ? <button type="button" className="btn btn-secondary" onClick={requestPermission}>Permitir avisos do navegador</button> : null}
      {lead ? <small>{permission === 'granted' ? 'Avisos na página e no navegador ativados.' : 'Avisos na página ativados.'}{permission === 'denied' ? ' As notificações do navegador estão bloqueadas nas configurações dele.' : ''}</small> : null}
      {lead > 0 && error ? <p role="status">Aguardando conexão para conferir os palpites. {error}</p> : null}
    </section> : null}
    {pending.length ? <aside className="prediction-reminder-banner" role="status"><div><strong>Falta enviar seu palpite!</strong><p>{pending.slice(0, 3).map((game) => `${game.timeA} × ${game.timeB} (${game.esporteNome})`).join(' · ')}{pending.length > 3 ? ` e mais ${pending.length - 3} jogo(s)` : ''}. O prazo está terminando.</p></div><button type="button" className="btn btn-primary" onClick={() => onNavigate('jogos')}>Fazer meus palpites</button><button type="button" className="btn btn-secondary" onClick={() => setNotices([])}>Dispensar aviso</button></aside> : null}
  </div>
}
