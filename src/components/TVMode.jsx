import { useEffect, useMemo, useState } from 'react'
import { subscribeAnnouncements, subscribeGames, subscribeBroadcastSettings } from '../services/bolaoService.js'
import { getUniqueGameSports } from '../utils/game.js'
import { getMatchScore } from '../utils/match.js'
import { buildTVSchedule, eventDate, schoolDay, SCHOOL_TIMEZONE, TV_SECTIONS } from '../utils/tvSchedule.js'
import TVMatchCard from './TVMatchCard.jsx'
import { formatSportScore } from '../utils/sportRules.js'
import { toDate } from '../utils/format.js'
import './TVMode.css'
import { buildAutomaticCalls, DEFAULT_BROADCAST_SETTINGS } from '../utils/automaticCalls.js'

const clockFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })

export default function TVMode({ onNavigate }) {
  const [games, setGames] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [broadcastSettings, setBroadcastSettings] = useState(DEFAULT_BROADCAST_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [synced, setSynced] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [now, setNow] = useState(() => new Date())
  const [sport, setSport] = useState('')
  const [cursor, setCursor] = useState('')
  const [duration, setDuration] = useState(() => {
    const stored = Number(window.localStorage.getItem('tv-interval'))
    return [8, 12, 20, 30].includes(stored) ? stored : 12
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [density, setDensity] = useState(() => Number(localStorage.getItem('tv-density')) === 4 ? 4 : 2)
  const [rotating, setRotating] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [compactLive, setCompactLive] = useState(() => window.innerHeight < 1000)
  const [screenMessage, setScreenMessage] = useState('')

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Interclasse SESI Vinhedo'
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => subscribeGames((items) => { setGames(items); setLoading(false) }, (message) => {
    setError(message)
    setLoading(false)
    setSynced(false)
  }, setSynced), [])

  useEffect(() => subscribeAnnouncements(setAnnouncements, setError), [])
  useEffect(() => subscribeBroadcastSettings(setBroadcastSettings, setError), [])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    const network = () => setOnline(navigator.onLine)
    const screen = () => setFullscreen(Boolean(document.fullscreenElement))
    const resize = () => setCompactLive(window.innerHeight < 1000)
    window.addEventListener('online', network)
    window.addEventListener('offline', network)
    document.addEventListener('fullscreenchange', screen)
    window.addEventListener('resize', resize)
    return () => {
      window.clearInterval(clock)
      window.removeEventListener('online', network)
      window.removeEventListener('offline', network)
      document.removeEventListener('fullscreenchange', screen)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    let active = true
    let wakeLock
    const keepAwake = async () => {
      if (!navigator.wakeLock || document.visibilityState !== 'visible') return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (!active) await next.release()
        else wakeLock = next
      } catch { /* Display remains usable when the device denies a wake lock. */ }
    }
    keepAwake()
    document.addEventListener('visibilitychange', keepAwake)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', keepAwake)
      wakeLock?.release().catch(() => {})
    }
  }, [])

  const sports = useMemo(() => getUniqueGameSports(games), [games])
  const day = schoolDay(now)
  const schedule = useMemo(() => buildTVSchedule(games, { day, sport, livePageSize: compactLive ? 2 : density, agendaPageSize: compactLive ? 4 : 6 }), [day, games, sport, compactLive, density])
  const { pages, counts, live } = schedule
  const pageKeys = JSON.stringify(pages.map((item) => item.id))
  const pageIndex = Math.max(0, pages.findIndex((item) => item.id === cursor))
  const page = pages[pageIndex]
  const tickerStart = (pageIndex % Math.max(1, Math.ceil(live.length / 3))) * 3
  const ticker = live.slice(tickerStart, tickerStart + 3)
  const activeAnnouncements = [...announcements.filter((item) => item.active && toDate(item.expiresAt).getTime() > now.getTime()), ...buildAutomaticCalls(sport ? games.filter((game) => game.sportId === sport || game.esporteNome === sport) : games, broadcastSettings, now)]
  const announcement = activeAnnouncements[Math.floor(now.getTime() / 10000) % activeAnnouncements.length]

  useEffect(() => {
    const ids = JSON.parse(pageKeys)
    if (!rotating || ids.length < 2) return
    const timer = window.setInterval(() => setCursor((current) => {
      const index = Math.max(0, ids.indexOf(current))
      return ids[(index + 1) % ids.length]
    }), duration * 1000)
    return () => window.clearInterval(timer)
  }, [duration, pageKeys, rotating])

  const step = (direction) => {
    if (pages.length) setCursor(pages[(pageIndex + direction + pages.length) % pages.length].id)
  }
  const toggleFullscreen = async () => {
    try {
      setScreenMessage('')
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen()
      else setScreenMessage('Use a opção de tela cheia do navegador para ampliar a exibição.')
    } catch {
      setScreenMessage('Não foi possível ampliar automaticamente. Use a tela cheia do navegador.')
    }
  }
  const leave = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    onNavigate('calendario')
  }

  return (
    <section className="tv-page" aria-label="Modo TV">
      <header className="tv-header">
        <div className="tv-brand"><img src="/logo-interclasse.png" alt="Interclasse SESI Vinhedo" /><div><span>SESI VINHEDO · ESPORTES</span><h1>Interclasse</h1></div></div>
        <div className="tv-clock"><time>{clockFormat.format(now)}</time><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: SCHOOL_TIMEZONE }).format(now)}</span></div>
      <button type="button" className="tv-settings-toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((value) => !value)}>{settingsOpen ? 'Fechar ajustes' : 'Ajustes da TV'}</button></header>
      <div className="tv-toolbar" hidden={!settingsOpen}>
        <div className={online && synced && !error ? 'tv-connection' : 'tv-connection is-offline'} role="status"><span />{error ? 'Atualização indisponível' : !online ? 'Sem conexão · exibindo últimos dados' : synced ? 'Atualizado em tempo real' : 'Aguardando sincronização'}</div>
        <label className="tv-sport-select">Esporte<select value={sport} onChange={(event) => { setSport(event.target.value); setCursor('') }}><option value="">Todos os esportes</option>{sports.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
        <label className="tv-interval-select">Intervalo<select value={duration} onChange={(event) => { const seconds = Number(event.target.value); setDuration(seconds); window.localStorage.setItem('tv-interval', String(seconds)) }}>{[8, 12, 20, 30].map((seconds) => <option key={seconds} value={seconds}>{seconds} s</option>)}</select></label>
        <label className="tv-density-select">Jogos ao vivo por tela<select value={density} onChange={(event) => { const value = Number(event.target.value); setDensity(value); localStorage.setItem('tv-density', String(value)) }}><option value="2">2 (maior destaque)</option><option value="4">4 (telas grandes)</option></select></label><div className="tv-controls">
          <button type="button" onClick={() => setRotating((current) => !current)}>{rotating ? 'Pausar rotação' : 'Retomar rotação'}</button>
          <button type="button" onClick={() => step(-1)} disabled={pages.length < 2}>Anterior</button>
          <button type="button" onClick={() => step(1)} disabled={pages.length < 2}>Próxima tela</button>
          <button type="button" onClick={toggleFullscreen}>{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button>
          <button type="button" onClick={leave}>Sair do modo TV</button>
        </div>
      </div>
      {error || screenMessage ? <div className="tv-notice" role="alert">{error || screenMessage}</div> : null}
      {announcement ? <aside className={`tv-announcement tv-announcement-${announcement.type}`} role="status"><strong>{announcement.type === 'chamada' ? 'CHAMADA' : announcement.type === 'atraso' ? 'ATENÇÃO' : 'AVISO'}</strong><span>{announcement.text}</span></aside> : null}
      <nav className="tv-section-nav" aria-label="Páginas da transmissão">{TV_SECTIONS.filter((section) => counts[section.id]).map((section) => <button key={section.id} type="button" className={page?.kind === section.id ? 'is-active' : ''} aria-pressed={page?.kind === section.id} disabled={!counts[section.id]} onClick={() => setCursor(pages.find((item) => item.kind === section.id)?.id || '')}>{section.label}<span>{counts[section.id]}</span></button>)}</nav>
      {live.length ? <aside className="tv-live-ticker" aria-label="Placares ao vivo"><strong><span className="live-dot" />AO VIVO · {live.length}</strong><div>{ticker.map((game) => <span key={game.id}><b>{game.esporteNome}</b> {game.timeA} <strong>{getMatchScore(game).map(formatSportScore).join(' : ')}</strong> {game.timeB}</span>)}</div>{live.length > ticker.length ? <small>+{live.length - ticker.length} partida(s)</small> : null}</aside> : null}
      {page ? (
        <div className={`tv-slide tv-slide-${page.kind}`} key={page.id}>
          <div className="tv-slide-heading"><div><span className="tv-slide-eyebrow">{page.kind === 'live' ? `${counts.live} partida(s) simultânea(s)` : page.sportName}</span><h2>{page.title}</h2><p>{page.description}</p></div><span className="tv-slide-part">{page.kind === 'live' ? 'PLACARES AO VIVO' : page.kind === 'tomorrow' ? dateFormat.format(eventDate(`${schedule.tomorrow}T12:00`)) : page.kind === 'today' ? dateFormat.format(now) : page.sportName}<strong>Página {page.part} / {page.parts}</strong></span></div>
          <div className={`tv-slide-cards ${page.kind === 'live' ? 'is-live' : ''} ${page.games.length === 1 ? 'is-single' : ''}`} data-count={page.games.length} style={{ '--tv-rows': Math.ceil(page.games.length / (page.kind === 'live' ? 2 : 3)) }}>
            {page.games.map((game) => <TVMatchCard key={game.id} game={game} now={now} showClock={broadcastSettings.showMatchClock !== false} />)}
          </div>
        </div>
      ) : <div className="tv-empty"><span aria-hidden="true">🏆</span><h2>{loading ? 'Carregando programação…' : 'Aguardando a programação'}</h2><p>Os jogos aparecerão aqui assim que forem cadastrados.</p></div>}
      <footer className={online && !error ? 'tv-footer' : 'tv-footer is-offline'}><strong>INTERCLASSE SESI VINHEDO <span>{error ? 'Atualização indisponível' : !online ? 'Sem conexão' : synced ? 'Ao vivo · atualizado' : 'Sincronizando'}</span></strong><span>{rotating ? `Rotação automática · ${duration} s por página` : 'Rotação pausada'} · Tela {pages.length ? pageIndex + 1 : 0}/{pages.length}</span></footer>
    </section>
  )
}
