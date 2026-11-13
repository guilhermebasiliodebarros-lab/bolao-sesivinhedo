import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeBroadcastSettings, subscribeGames, subscribeScoreboardSelection } from '../services/bolaoService.js'
import { recentScoreEvent, scoreboardIncidents, scoreboardSport } from '../utils/scoreboard.js'
import ScoreboardIncidents, { IncidentIcon } from './ScoreboardIncidents.jsx'
import { buildSelectedScoreboard } from '../utils/scoreboardSelection.js'
import { getGameStageLabel } from '../utils/game.js'
import { getMatchCondition, getMatchLabel, getMatchState, MATCH_STATE } from '../utils/match.js'
import { getSportProfile, formatSportScore } from '../utils/sportRules.js'
import { scorePresentation } from '../utils/scorePresentation.js'
import { currentSetScore } from '../utils/liveEvents.js'
import { formatMatchClock, matchClockValue } from '../utils/matchClock.js'
import { matchPeriod } from '../utils/matchPeriods.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import { tieBreakSummary } from '../utils/tieBreak.js'
import { eventDate, schoolDay, SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import { DEFAULT_BROADCAST_SETTINGS } from '../utils/automaticCalls.js'
import useBroadcastScreen from '../hooks/useBroadcastScreen.js'
import './TVScoreboard.css'
import TVConnectionStatus from './TVConnectionStatus.jsx'
import { transmissionHealth } from '../utils/transmissionHealth.js'

const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, day: '2-digit', month: '2-digit' })
const fullDateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, weekday: 'long', day: '2-digit', month: 'long' })
const vestColors = { Vermelho: '#ff6a72', Azul: '#71a8ff', Amarelo: '#ffdd66', Verde: '#74e1ae', Laranja: '#ffad66', Rosa: '#f4a3d2', Branco: '#fff', Preto: '#707784', Roxo: '#bca1ff' }
const titles = { live: 'Acontecendo agora', upcoming: 'Aguardando o início', results: 'Resultado final', empty: 'Aguardando seleção da organização' }

function SportGlyph({ sport, className = '' }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="16" cy="16" r="12" />{sport === 'basketball' ? <><path d="M4 16h24M16 4v24M7 7c12 4 12 14 18 18M25 7C13 11 13 21 7 25" /></> : sport === 'volleyball' ? <><path d="m16 4 4 10-8 9M5 11l11 5 11-4M12 27l-1-11 8-10M27 20l-9-1" /></> : sport === 'football' ? <><path d="m16 10 6 4-2 7h-8l-2-7 6-4Zm0 0V4m6 10 6-2m-8 9 3 5m-11-5-3 5m1-12-6-2" /></> : <><path d="m8 8 16 16M24 8 8 24M4 16h24" /></>}</svg>
}

function scheduleTime(game, now) {
  const date = eventDate(game.dataHora)
  if (!Number.isFinite(date.getTime())) return 'Horário a definir'
  return `${schoolDay(date) === schoolDay(now) ? '' : `${dateFormat.format(date)} · `}${timeFormat.format(date)}`
}

function ScoreboardMatch({ game, now, showClock, connected }) {
  const state = getMatchState(game)
  const live = state === MATCH_STATE.LIVE
  const finished = state === MATCH_STATE.FINISHED
  const walkover = getMatchCondition(game) === 'walkover'
  const family = scoreboardSport(game)
  const profile = getSportProfile(game)
  const score = scorePresentation(game)
  const clock = matchClockValue(game, now)
  const period = matchPeriod(game, now)
  const set = currentSetScore(game)
  const inSet = profile.scoringMode === 'sets' && live && Math.max(game.liveScoreA || 0, game.liveScoreB || 0) < Math.ceil(profile.volleyballBestOf / 2)
  const event = connected ? recentScoreEvent(game, now) : null
  const incidents = scoreboardIncidents(game)
  const hasIncidents = incidents.length > 0
  const sets = live ? [game.liveScoreA || 0, game.liveScoreB || 0] : [game.placarA, game.placarB]
  const scoreUnit = profile.scoringMode === 'sets' ? inSet ? 'PONTOS' : 'SETS' : profile.scoringMode === 'goals' ? 'GOLS' : 'PONTOS'
  return <article className={`sb-match sb-match-${family}${live ? ' is-live' : ''}${event ? ' has-event' : ''}${hasIncidents ? ' has-incidents' : ''}`} data-game-id={game.id} aria-label={`${game.esporteNome}: ${game.timeA} contra ${game.timeB}`}>
    <header className="sb-match-header"><div className="sb-sport"><SportGlyph sport={family} /><h2>{game.esporteNome}</h2></div><span className={`sb-match-state${live && connected ? ' is-live' : ''}`}>{live && connected ? <i /> : null}{live && !connected ? 'Último placar' : getMatchLabel(game)}</span></header>
    <div className="sb-match-context"><span>{matchVenueLabel(game) || 'Interclasse SESI Vinhedo'}</span><span title={getGameStageLabel(game)}>{getGameStageLabel(game)}</span></div>
    <div className="sb-duel">{['A', 'B'].map((side, index) => <div className={`sb-team sb-team-${side}`} key={side}>
      <h3 title={game[`time${side}`]}>{game[`time${side}`] || 'A definir'}</h3>
      {live || finished ? <output className="sb-score" aria-label={`Placar de ${game[`time${side}`] || side}`} aria-live="polite"><span key={`${score.values?.[index]}:${scoreUnit}`} data-digits={String(score.values?.[index] ?? '').length}>{score.values ? formatSportScore(score.values[index]) : walkover ? '—' : score.text}</span></output> : <div className="sb-awaiting-score">—</div>}
      <span className="sb-team-detail">{walkover ? <b>{game.walkoverWinner === side ? 'VENCEU POR W.O.' : 'W.O.'}</b> : profile.scoringMode === 'sets' && (live || finished) ? <b>{formatSportScore(sets[index])} <small>SETS</small></b> : live || finished ? <b>{scoreUnit}</b> : <b>EQUIPE {side}</b>}{game[`vest${side}`] ? <span className="sb-vest"><i style={{ backgroundColor: vestColors[game[`vest${side}`]] || '#b8c4d6' }} />{game[`vest${side}`]}</span> : null}</span>
    </div>)}<div className="sb-duel-center">{live ? <>{profile.scoringMode === 'sets' ? <span className="sb-set-number">{inSet ? `${set.number}º SET` : 'SETS DEFINIDOS'}</span> : period.supported ? <span className={`sb-period-label${period.interval ? ' is-interval' : ''}`}>{period.label}</span> : <span className="sb-versus">VS</span>}{showClock ? <><span className="sb-clock-label">{clock.running ? 'TEMPO DE JOGO' : 'TEMPO PAUSADO'}</span><time className={`sb-match-clock${!clock.running ? ' is-paused' : ''}`}>{formatMatchClock(period.supported ? period.elapsedMs : clock.elapsedMs)}</time>{period.supported && period.number > 1 ? <small>Acumulado: {formatMatchClock(clock.elapsedMs)}</small> : null}{period.exceeded ? <small>Tempo previsto atingido</small> : null}</> : null}</> : finished ? <><span className="sb-versus">FIM</span><small>{getMatchCondition(game) === 'walkover' ? 'Vitória por W.O.' : 'Placar final'}</small></> : <><span className="sb-clock-label">INÍCIO PREVISTO</span><strong className="sb-kickoff">{scheduleTime(game, now)}</strong></>}</div></div>
    {hasIncidents ? <ScoreboardIncidents game={game} now={now} recent={event} incidents={incidents} /> : null}
    {!hasIncidents || profile.scoringMode === 'sets' || game.tieBreak ? <footer className="sb-match-footer">{event && !hasIncidents ? <div className="sb-score-event" key={`${event.id}:${event.label}`} role="status"><IncidentIcon kind={event.kind} /><strong>{event.label}</strong><span>{event.player ? `${event.player} · ` : ''}{event.team}{event.minute !== null ? ` · ${event.minute}′` : ''}</span></div> : profile.scoringMode === 'sets' && game.setScores?.length ? <div className="sb-set-history">{game.setScores.map((partial, index) => <span key={index}><small>{index + 1}º SET</small><b>{partial.a} : {partial.b}</b></span>)}</div> : <div className="sb-match-note"><span className="sb-note-line" />{game.tieBreak ? tieBreakSummary(game) : finished ? game.tournamentName || 'Resultado confirmado pela organização' : live ? game.eventsAdjusted ? 'Placar atualizado pela organização' : 'Cada lance conta. Torça pela sua turma.' : game.tournamentName || 'O placar aparece automaticamente ao iniciar.'}<span className="sb-note-line" /></div>}</footer> : null}
  </article>
}

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
  const goToCalendar = () => leave('calendario')

  return <section className={`scoreboard-screen${!fullscreen || controlsVisible || settingsOpen ? ' show-controls' : ''}`} aria-label="Placar ao vivo para TV" data-layout={model.games.length}>
    <header className="sb-header">
      <div className="sb-header-left">
        <button type="button" className="sb-back-button" onClick={() => leave('tv')} aria-label="Voltar ao Modo TV" title="Voltar ao Modo TV"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12" /></svg><span>Voltar</span></button>
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
      <nav><button type="button" onClick={() => leave('tv')}>Programação rotativa</button><button type="button" onClick={goToCalendar}>Voltar ao site</button></nav>
    </dialog>
  </section>
}
