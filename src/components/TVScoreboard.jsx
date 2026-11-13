import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeBroadcastSettings, subscribeGames, subscribeScoreboardSelection } from '../services/bolaoService.js'
import { buildSelectedScoreboard } from '../utils/scoreboardSelection.js'
import { getMatchLabel } from '../utils/match.js'
import { SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import { DEFAULT_BROADCAST_SETTINGS } from '../utils/automaticCalls.js'
import useBroadcastScreen from '../hooks/useBroadcastScreen.js'
import TVConnectionStatus from './TVConnectionStatus.jsx'
import { transmissionHealth } from '../utils/transmissionHealth.js'
import ScoreboardMatch, { SportGlyph } from './ScoreboardMatch.jsx'
import './TVScoreboard.css'

const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const fullDateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, weekday: 'long', day: '2-digit', month: 'long' })
const titles = { live: 'Acontecendo agora', upcoming: 'Aguardando o início', results: 'Resultado final', empty: 'Aguardando seleção da organização' }

export default function TVScoreboard({ onNavigate }) {
  const [games, setGames] = useState([])
  const [selection, setSelection] = useState({ gameIds: [], revision: 0 })
  const [broadcastSettings, setBroadcastSettings] = useState(DEFAULT_BROADCAST_SETTINGS)
  const [gamesLoading, setGamesLoading] = useState(true)
  const [selectionLoading, setSelectionLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [gamesSynced, setGamesSynced] = useState(false)
  const [selectionSynced, setSelectionSynced] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [lastSelectionSync, setLastSelectionSync] = useState(null)
  const [healthStartedAt] = useState(() => Date.now())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [shareMessage, setShareMessage] = useState('')
  const settingsRef = useRef(null)
  const { now, online, fullscreen, toggleFullscreen, message: screenMessage } = useBroadcastScreen()
  const loading = gamesLoading || selectionLoading

  useEffect(() => {
    const previous = document.title
    document.title = 'Placar ao vivo · Interclasse SESI Vinhedo'
    return () => { document.title = previous }
  }, [])

  useEffect(() => subscribeGames(
    (items) => { setGames(items); setGamesLoading(false) },
    (message) => { setError(message); setGamesSynced(false); setGamesLoading(false) },
    (connected, info) => {
      setGamesSynced(connected)
      if (connected) { setError(''); setLastSync(info?.lastServerAt || Date.now()) }
    },
  ), [])

  useEffect(() => subscribeScoreboardSelection(
    (value) => { setSelection(value); setSelectionLoading(false); setSelectionError('') },
    (message) => { setSelectionError(message); setSelectionSynced(false); setSelectionLoading(false) },
    (connected, info) => { setSelectionSynced(connected); if (connected) setLastSelectionSync(info?.lastServerAt || Date.now()) },
  ), [])

  useEffect(() => subscribeBroadcastSettings((settings) => { setBroadcastSettings(settings); setSettingsError('') }, setSettingsError), [])

  useEffect(() => {
    const dialog = settingsRef.current
    if (!settingsOpen) return
    dialog.showModal()
    return () => dialog.close()
  }, [settingsOpen])

  useEffect(() => {
    let timer
    const reveal = () => {
      setControlsVisible(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setControlsVisible(false), 6000)
    }
    timer = window.setTimeout(() => setControlsVisible(false), 6000)
    window.addEventListener('pointermove', reveal)
    window.addEventListener('keydown', reveal)
    window.addEventListener('touchstart', reveal, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', reveal)
      window.removeEventListener('keydown', reveal)
      window.removeEventListener('touchstart', reveal)
    }
  }, [])

  const model = useMemo(() => buildSelectedScoreboard(games, selection), [games, selection])
  const health = transmissionHealth({ now, startedAt: healthStartedAt, online, connected: gamesSynced && selectionSynced, error: Boolean(error || selectionError), feeds: [{ name: 'Placares', lastServerAt: lastSync, maxAgeMs: 75000 }, { name: 'Seleção dos jogos', lastServerAt: lastSelectionSync, maxAgeMs: 135000 }] })
  const connected = health.connected
  const share = async () => {
    const url = new URL(window.location.href)
    url.hash = 'placar'
    url.search = ''
    try { await navigator.clipboard.writeText(url.href); setShareMessage('Link copiado. Abra no navegador da TV.') }
    catch { setShareMessage(`Abra este endereço na TV: ${url.href}`) }
  }
  const leave = async (view) => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    onNavigate(view)
  }
  const goToSite = () => leave('home')

  return <section className={`scoreboard-screen${!fullscreen || controlsVisible || settingsOpen ? ' show-controls' : ''}`} aria-label="Placar ao vivo para TV" data-layout={model.games.length}>
    <header className="sb-header">
      <div className="sb-header-left">
        <button type="button" className="sb-back-button" onClick={goToSite} aria-label="Voltar ao site principal" title="Voltar ao site principal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12" /></svg><span>Voltar</span></button>
      <div className="sb-brand"><img src="/logo-interclasse.png" alt="Interclasse SESI Vinhedo" /><div><span>SESI VINHEDO</span><h1>O jogo é aqui.</h1></div></div>
      </div>
      <div className="sb-header-right">
        <div className="sb-controls">
          <button type="button" className="sb-icon-button" onClick={() => setSettingsOpen(true)} aria-label="Ajustar placar da TV" title="Ajustar placar da TV"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6" /></svg></button>
          <button type="button" className="sb-icon-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg></button>
        </div>
        <div className="sb-wall-clock"><time>{timeFormat.format(now)}</time><span>{fullDateFormat.format(now)}</span></div>
      </div>
    </header>
    <div className="sb-broadcast-bar">
      <div className="sb-headline"><span className={`sb-signal${connected ? '' : ' is-disconnected'}`}><i />{connected ? 'TRANSMISSÃO AO VIVO' : !online ? 'SEM CONEXÃO' : health.state === 'stale' ? 'DADOS ATRASADOS' : 'SINCRONIZANDO'}</span><span className="sb-headline-divider" /><h2>{loading ? 'Conectando à quadra…' : titles[model.kind]}</h2></div>
      <span className="sb-match-count">{model.games.length ? <><b>{String(model.games.length).padStart(2, '0')}</b> {model.games.length === 1 ? 'JOGO SELECIONADO' : 'JOGOS SELECIONADOS'}</> : 'AGUARDANDO SELEÇÃO'}</span>
    </div>
    {!online || error || selectionError || settingsError || screenMessage ? <div className="sb-notice" role="status">{!online ? 'Sem conexão. A última seleção e os últimos placares continuam na tela; a atualização será retomada automaticamente.' : error || selectionError ? 'Aguardando reconexão. Exibindo a última seleção e os últimos placares recebidos.' : settingsError ? 'As configurações do cronômetro estão temporariamente indisponíveis.' : screenMessage}</div> : null}
    {model.unavailable && !loading ? <div className="sb-notice" role="status">Uma partida selecionada foi removida, cancelada ou adiada. Aguardando nova seleção da organização.</div> : null}
    {health.state === 'stale' ? <div className="sb-notice" role="status">A confirmação do servidor está demorando. Exibindo os últimos dados. Abra o diagnóstico da TV para conferir a conexão.</div> : null}
    {model.games.length && !loading ? <main className="sb-grid" data-count={model.games.length}>{model.games.map((game) => <ScoreboardMatch key={game.id} game={game} now={now} showClock={broadcastSettings.showMatchClock !== false} connected={connected} />)}</main> : <main className="sb-empty">
      <div className="sb-empty-court" aria-hidden="true"><span /><i /></div>
      <span className="sb-empty-eyebrow">{loading ? 'PREPARANDO A TRANSMISSÃO' : 'A TV ESTÁ PRONTA'}</span>
      <h2>{loading ? 'Conectando à quadra…' : 'Aguardando os jogos.'}</h2>
      <p>{loading ? 'Buscando os jogos escolhidos pela organização.' : 'As partidas selecionadas pela organização aparecerão aqui. Um jogo em tela inteira ou dois lado a lado.'}</p>
      <div>{['basketball', 'volleyball', 'football', 'handball'].map((name, index) => <span key={name}><SportGlyph sport={name} />{['Basquete', 'Vôlei', 'Futebol', 'Handebol'][index]}</span>)}</div>
    </main>}
    <footer className="sb-footer"><TVConnectionStatus health={health} now={now} /><strong>UMA ESCOLA. VÁRIAS TURMAS. UM SÓ INTERCLASSE.</strong><span className="sb-footer-label">PLACAR OFICIAL</span></footer>
    <dialog className="sb-settings" ref={settingsRef} aria-labelledby="sb-settings-title" onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)}>
      <header><div><span>TRANSMISSÃO · SESI VINHEDO</span><h2 id="sb-settings-title">Os jogos escolhidos. Ao vivo.</h2></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label="Fechar ajustes">×</button></header>
      <p>A organização escolhe os jogos em <strong>Painel master → Ao vivo / TV → Escolher jogos do placar</strong>. A seleção é enviada automaticamente para esta TV.</p>
      <div className="sb-selected-summary" aria-label="Jogos selecionados">{model.games.map((game) => <p key={game.id}><strong>{game.timeA} × {game.timeB}</strong><span>{game.esporteNome} · {getMatchLabel(game)}</span></p>)}{!model.games.length ? <p>Nenhum jogo selecionado.</p> : null}</div>
      <small>Um jogo ocupa a tela inteira. Dois jogos ficam lado a lado. O placar permanece nesta seleção até a organização alterá-la.</small>
      <div className="sb-settings-actions"><button className="sb-primary-button" type="button" onClick={async () => { setSettingsOpen(false); await toggleFullscreen() }}>{fullscreen ? 'Sair da tela cheia' : 'Iniciar em tela cheia'}</button><button type="button" onClick={share}>Copiar link desta TV</button></div>
      {shareMessage ? <p role="status" className="sb-share-message">{shareMessage}</p> : null}
      <nav><button type="button" onClick={() => leave('tv')}>Programação rotativa</button><button type="button" onClick={goToSite}>Voltar ao site</button></nav>
    </dialog>
  </section>
}
