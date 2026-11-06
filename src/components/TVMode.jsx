import { useEffect, useMemo, useState } from 'react'
import { subscribeGames } from '../services/bolaoService.js'
import { getGameStageLabel, getSportIcon, getUniqueGameSports, matchesSport } from '../utils/game.js'
import { toDate } from '../utils/format.js'
import { getMatchScore, getMatchState, MATCH_STATE } from '../utils/match.js'
import MatchBadge from './MatchBadge.jsx'
import './TVMode.css'

const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function gameTime(value) {
  const date = toDate(value)
  return Number.isNaN(date.getTime()) ? 'A definir' : `${dateFormat.format(date)} · ${timeFormat.format(date)}`
}

function pageItems(items, page) {
  const start = (page % Math.max(1, Math.ceil(items.length / 5))) * 5
  return items.slice(start, start + 5)
}

export default function TVMode({ onNavigate }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [synced, setSynced] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [now, setNow] = useState(() => new Date())
  const [sport, setSport] = useState('')
  const [page, setPage] = useState(0)
  const [rotating, setRotating] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [screenMessage, setScreenMessage] = useState('')

  useEffect(() => subscribeGames((items) => { setGames(items); setLoading(false) }, (message) => {
    setError(message)
    setLoading(false)
    setSynced(false)
  }, setSynced), [])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    const network = () => setOnline(navigator.onLine)
    const screen = () => setFullscreen(Boolean(document.fullscreenElement))
    window.addEventListener('online', network)
    window.addEventListener('offline', network)
    document.addEventListener('fullscreenchange', screen)
    return () => {
      window.clearInterval(clock)
      window.removeEventListener('online', network)
      window.removeEventListener('offline', network)
      document.removeEventListener('fullscreenchange', screen)
    }
  }, [])

  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => setPage((current) => current + 1), 12000)
    return () => window.clearInterval(timer)
  }, [rotating])

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
  const visible = useMemo(() => games.filter((game) => matchesSport(game, sport)), [games, sport])
  const live = visible.filter((game) => getMatchState(game) === MATCH_STATE.LIVE)
  const upcoming = visible.filter((game) => getMatchState(game) === MATCH_STATE.SCHEDULED)
  const results = visible.filter((game) => getMatchState(game) === MATCH_STATE.FINISHED).sort((a, b) => (
    toDate(b.endedAt || b.dataHora).getTime() - toDate(a.endedAt || a.dataHora).getTime()
  ))
  const featured = live[page % live.length] || upcoming[0] || results[0]
  const featuredState = getMatchState(featured)
  const score = featured ? getMatchScore(featured) : [0, 0]
  const otherLive = live.filter((game) => game.id !== featured?.id).slice(0, 3)
  const totalPages = Math.max(live.length, Math.ceil(upcoming.length / 5), Math.ceil(results.length / 5), 1)

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
        <div className="tv-brand"><img src="/logo.png" alt="Bolão SESI Vinhedo" /><div><span>SESI VINHEDO</span><h1>Central de jogos</h1></div></div>
        <div className="tv-clock"><time>{clockFormat.format(now)}</time><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Sao_Paulo' }).format(now)}</span></div>
      </header>
      <div className="tv-toolbar">
        <div className={online && synced && !error ? 'tv-connection' : 'tv-connection is-offline'} role="status">
          <span />{error ? 'Atualização indisponível' : !online ? 'Sem conexão · exibindo últimos dados' : synced ? 'Atualizado em tempo real' : 'Aguardando sincronização'}
        </div>
        <label className="tv-sport-select">Esporte<select value={sport} onChange={(event) => { setSport(event.target.value); setPage(0) }}><option value="">Todos os esportes</option>{sports.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
        <div className="tv-controls">
          <button type="button" onClick={() => setRotating((current) => !current)}>{rotating ? 'Pausar rotação' : 'Retomar rotação'}</button>
          <button type="button" onClick={() => setPage((current) => current + 1)}>Próxima tela</button>
          <button type="button" onClick={toggleFullscreen}>{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button>
          <button type="button" onClick={leave}>Sair do modo TV</button>
        </div>
      </div>
      {error || screenMessage ? <div className="tv-notice" role="alert">{error || screenMessage}</div> : null}
      <div className="tv-grid">
        <section className={`tv-feature ${live.length ? 'has-live-game' : ''}`} aria-label="Jogo em destaque">
          <div className="tv-panel-heading"><span>{live.length ? 'ACONTECENDO AGORA' : upcoming.length ? 'A SEGUIR' : 'ÚLTIMO RESULTADO'}</span><strong>{live.length ? `${live.length} ao vivo` : `${visible.length} jogo(s)`}</strong></div>
          {featured ? (
            <div className="tv-feature-content" key={featured.id}>
              <div className="tv-feature-meta"><span>{getSportIcon(featured.esporteNome)} {featured.esporteNome}</span><MatchBadge game={featured} /></div>
              <p className="tv-stage">{featured.tournamentName ? `${featured.tournamentName} · ` : ''}{getGameStageLabel(featured)}</p>
              <div className="tv-scoreboard"><strong>{featured.timeA}</strong><div>{featuredState === MATCH_STATE.SCHEDULED ? <span className="tv-versus">×</span> : <><b>{score[0]}</b><span>:</span><b>{score[1]}</b></>}</div><strong>{featured.timeB}</strong></div>
              <p className="tv-feature-time">{featuredState === MATCH_STATE.LIVE ? 'Partida em andamento' : featuredState === MATCH_STATE.FINISHED ? 'Placar final' : 'Horário programado'}<strong>{gameTime(featuredState === MATCH_STATE.LIVE ? featured.startedAt || featured.dataHora : featured.dataHora)}</strong></p>
              {otherLive.length ? <div className="tv-other-live"><span>Também ao vivo</span>{otherLive.map((game) => <div key={game.id}><span>{game.esporteNome} · {game.timeA} × {game.timeB}</span><strong>{getMatchScore(game).join(' : ')}</strong></div>)}</div> : null}
            </div>
          ) : <div className="tv-empty"><span aria-hidden="true">🏆</span><h2>{loading ? 'Carregando programação…' : 'Aguardando a programação'}</h2><p>Os jogos aparecerão aqui assim que forem cadastrados.</p></div>}
        </section>
        <section className="tv-list-panel" aria-label="Próximos jogos">
          <div className="tv-panel-heading"><h2>Próximos jogos</h2><span>{upcoming.length}</span></div>
          <div className="tv-fixtures">{pageItems(upcoming, page).map((game) => <article key={game.id} className="tv-fixture"><div><span>{game.esporteNome}</span><time>{gameTime(game.dataHora)}</time></div><strong>{game.timeA}<span> × </span>{game.timeB}</strong><small>{getGameStageLabel(game)}</small></article>)}</div>
          {!upcoming.length ? <p className="tv-list-empty">Nenhuma partida aguardando início.</p> : null}
          {upcoming.length > 5 ? <span className="tv-page-count">Página {page % Math.ceil(upcoming.length / 5) + 1} de {Math.ceil(upcoming.length / 5)}</span> : null}
        </section>
        <section className="tv-list-panel tv-results" aria-label="Resultados anteriores">
          <div className="tv-panel-heading"><h2>Últimos resultados</h2><span>{results.length}</span></div>
          <div className="tv-fixtures">{pageItems(results, page).map((game) => <article key={game.id} className="tv-fixture"><div><span>{game.esporteNome}</span><time>{gameTime(game.dataHora)}</time></div><div className="tv-result-row"><strong>{game.timeA}<span>{game.timeB}</span></strong><b>{getMatchScore(game)[0]}<span>{getMatchScore(game)[1]}</span></b></div><small>{getGameStageLabel(game)}</small></article>)}</div>
          {!results.length ? <p className="tv-list-empty">Os placares aparecem aqui quando a organização encerrar as partidas.</p> : null}
          {results.length > 5 ? <span className="tv-page-count">Página {page % Math.ceil(results.length / 5) + 1} de {Math.ceil(results.length / 5)}</span> : null}
        </section>
      </div>
      <footer className="tv-footer"><strong>BOLÃO SESI VINHEDO <span>Torça pela sua turma.</span></strong><span>{rotating ? 'Rotação automática a cada 12 s' : 'Rotação pausada'} · Tela {page % totalPages + 1}/{totalPages}</span></footer>
    </section>
  )
}
