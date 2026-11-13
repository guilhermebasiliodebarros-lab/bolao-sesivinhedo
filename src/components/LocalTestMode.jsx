import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../context/useAuth.js'
import { MatchOperationsContext } from '../context/match-operations-context.js'
import { createLocalTestSession, TEST_SPORTS } from '../utils/localTestSession.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import useModalDialog from '../hooks/useModalDialog.js'
import RefereePanel from './RefereePanel.jsx'
import ScoreboardMatch from './ScoreboardMatch.jsx'
import './LocalTestMode.css'

function TestPreview({ games, now, full = false, onExpand, tools }) {
  return <section className={`scoreboard-screen local-test-preview${full ? ' is-full' : ' is-embedded'}`} aria-label="TV de teste">
    <aside className="local-test-tv-badge">MODO TESTE · JOGOS E ALUNOS FICTÍCIOS</aside>
    <header className="local-test-preview-header"><img src="/logo-interclasse.png" alt="Interclasse SESI Vinhedo" /><div><strong>Placar de teste</strong><span>{games.length === 2 ? 'Dois jogos simultâneos' : 'Um jogo selecionado'}</span></div>{tools || <button type="button" onClick={onExpand}>Ampliar TV de teste</button>}</header>
    <main className="sb-grid" data-count={games.length}>{games.map((game) => <ScoreboardMatch game={game} now={now} showClock connected key={game.id} />)}</main>
    <footer className="local-test-tv-footer">Prévia local · os placares oficiais não são alterados</footer>
  </section>
}

function TestTVDialog({ games, now, onClose }) {
  const dialog = useRef(null), ownsFullscreen = useRef(false)
  const [message, setMessage] = useState('')
  useModalDialog(dialog)
  useEffect(() => {
    return () => { if (ownsFullscreen.current && document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  }, [])
  const close = async () => {
    if (ownsFullscreen.current && document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    onClose()
  }
  return <dialog className="local-test-tv-dialog" ref={dialog} aria-label="TV de teste ampliada" onCancel={(event) => { event.preventDefault(); close() }}><div className="local-test-tv-screen">
    <TestPreview games={games} now={now} full tools={<div className="local-test-tv-tools"><button type="button" onClick={close}>Voltar aos controles</button><button type="button" onClick={async () => {
      try {
        if (document.fullscreenElement) { await document.exitFullscreen(); ownsFullscreen.current = false }
        else { await document.documentElement.requestFullscreen(); ownsFullscreen.current = true }
      } catch { setMessage('Use a tela cheia do navegador para ampliar a prévia.') }
    }}>Tela cheia</button></div>} />
    {message ? <p className="local-test-screen-message" role="status">{message}</p> : null}
  </div></dialog>
}

export default function LocalTestMode({ onClose }) {
  const { user } = useAuth()
  const [session] = useState(() => createLocalTestSession())
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const [sport, setSport] = useState('futebol')
  const [selectedId, setSelectedId] = useState('teste-futebol-1')
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer) }, [])
  const games = snapshot.games.filter((game) => game.sportId === `teste-esporte-${sport}`)
  const game = games.find((item) => item.id === selectedId) || games[0]
  const advance = () => {
    try { session.advance(game.id); setNow(new Date()); setMessage('Um minuto acrescentado somente ao relógio deste jogo de teste.') } catch (error) { setMessage(error.message) }
  }
  return <MatchOperationsContext.Provider value={session.api}>
    <section className="local-test-mode" aria-label="Modo de teste dentro do sistema">
      <div className="local-test-heading"><div><span className="eyebrow">Teste dentro do sistema</span><h2>Experimente antes dos jogos.</h2><p>Marque gols, pontos e cartões nos alunos fictícios e acompanhe a prévia da TV ao lado.</p></div><button className="btn btn-outline" type="button" onClick={onClose}>Sair do modo teste</button></div>
      <div className="local-test-notice" role="status"><strong>MODO TESTE · DADOS FICTÍCIOS</strong><span>Os comandos valem apenas nesta sessão. Não alteram jogos, alunos, palpites ou a TV oficial. Ao sair, os testes são descartados.</span></div>
      <div className="local-test-actions"><nav className="segmented-control" aria-label="Esporte do teste">{TEST_SPORTS.map((item) => <button type="button" key={item.id} className={item.id === sport ? 'is-active' : ''} aria-pressed={item.id === sport} onClick={() => { setSport(item.id); setSelectedId(`teste-${item.id}-1`); setMessage('') }}>{item.nome}{item.pairs.length === 2 ? ' · 2 jogos' : ''}</button>)}</nav><button type="button" className="btn btn-outline btn-small" onClick={() => { session.reset(); setNow(new Date()); setMessage('Os seis jogos fictícios foram reiniciados. Os jogos oficiais permanecem iguais.') }}>Reiniciar todos os testes</button></div>
      <p className="local-test-how">Escolha o esporte, toque no nome do aluno para marcar e abra <strong>Cartões da partida</strong> para testar amarelo e vermelho. Use <strong>Ampliar TV de teste</strong> para ver a apresentação maior.</p>
      {message ? <p className="alert" role="status">{message}</p> : null}
      <div className="local-test-columns">
        <div className="local-test-operation"><div className="local-test-operation-heading"><h3>Operar jogo de teste</h3>{games.length === 2 ? <label>Jogo para operar<select value={game.id} onChange={(event) => setSelectedId(event.target.value)}>{games.map((item, index) => <option key={item.id} value={item.id}>Jogo {index + 1}: {item.timeA} × {item.timeB}</option>)}</select></label> : null}<button type="button" className="btn btn-outline btn-small" disabled={getMatchState(game) !== MATCH_STATE.LIVE || game.period?.phase === 'interval'} onClick={advance}>Adiantar 1 minuto neste jogo</button></div>
          <div className="local-test-control-scroll"><RefereePanel key={`${snapshot.generation}:${game.id}`} game={game} teams={snapshot.teams} user={user} onSaved={() => setMessage('Resultado do jogo de teste publicado somente na prévia. Reinicie os testes para jogar novamente.')} /></div>
        </div>
        <div className="local-test-preview-wrap"><TestPreview games={games} now={now} onExpand={() => setExpanded(true)} /></div>
      </div>
    </section>
    {expanded ? <TestTVDialog games={games} now={now} onClose={() => setExpanded(false)} /> : null}
  </MatchOperationsContext.Provider>
}
